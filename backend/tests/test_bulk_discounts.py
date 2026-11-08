import unittest
import jwt
from pathlib import Path
import re
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
import test_order_creation as fixtures
from app.crud.bulk_pricing import compute_bulk,cod_due
from app.db.models import Dish,Order,User
from app.crud.shift import get_revenue_report,calculate_staff_shift_orders
from app.core.security import decode_token
from app.core.config import settings
from app.crud.chat_order import prepare_draft,confirm_draft,lock_customer
from app.db.chat_models import ChatOrderDraft,ChatDeliveryPreference
from app.schemas.dish import DishUpdateRequest
from pydantic import ValidationError


class BulkMathTests(unittest.TestCase):
    def test_configured_servings_are_nonnegative_integers(self):
        for value in (None,True,-1,1.5,21):
            with self.assertRaises(ValidationError):DishUpdateRequest.model_validate({'eligible_servings':value})
        self.assertEqual(DishUpdateRequest.model_validate({'eligible_servings':3}).eligible_servings,3)
        self.assertNotIn('eligible_servings',DishUpdateRequest.model_validate({}).model_dump(exclude_unset=True))
    def test_thresholds_and_rounding(self):
        for count,rate,ship in [(4,0,5000),(5,0,0),(9,0,0),(10,6,0),(19,6,0),(20,8,0),(29,8,0),(30,12,0)]:
            p=compute_bulk(600000,count,5000)
            self.assertEqual(p['discount_rate'],rate);self.assertEqual(Decimal(p['shipping_fee']),ship)
        p=compute_bulk(600000,10,5000)
        self.assertEqual((p['discount_amount'],p['total_amount'],p['deposit_amount'],p['cod_due']),('36000','564000','282000','282000'))
        self.assertEqual(compute_bulk(499999,0,0)['deposit_amount'],'0')
        self.assertEqual(compute_bulk(500000,0,0)['deposit_amount'],'250000')
        self.assertEqual(compute_bulk(500001,0,0)['deposit_amount'],'250001')
        self.assertEqual(compute_bulk('100025',10,0)['discount_amount'],'6002')


class BulkIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):fixtures.OrderCreationTests.setUpClass.__func__(cls)
    def setUp(self):
        fixtures.OrderCreationTests.setUp(self)
        self.enterContext(patch('app.crud.user.is_redis_revoked',return_value=False))
        with self.sessions.begin() as db:
            db.get(Dish,'rice').eligible_servings=1
            d=db.get(Dish,'premium');d.eligible_servings=1;d.price=60000;d.base_price=55000
    payload=fixtures.OrderCreationTests.payload
    post=fixtures.OrderCreationTests.post
    def large(self):
        p=self.payload();p['items']=[{'dish_id':'premium','quantity':10}];return p
    def quote(self,payload=None,user=1):
        token=fixtures.create_access_token({'sub':str(user),'role':'customer'})
        with self.app.test_client() as c:
            return c.post('/api/v1/orders/quote',json=payload or self.large(),headers={'Authorization':f'Bearer {token}'})
    def create_large(self):
        p=self.large();r=self.quote(p);self.assertEqual(r.status_code,200,r.get_json())
        p['deposit_token']=r.get_json()['data']['deposit_token']
        return self.post(p),p

    def test_quote_no_order_required_confirmation_and_amounts(self):
        r=self.quote();self.assertEqual(r.status_code,200,r.get_json())
        with self.sessions() as db:self.assertEqual(db.query(Order).count(),0)
        p=r.get_json()['data']['bulk_pricing'];self.assertEqual(Decimal(p['deposit_amount']),282000)
        self.assertEqual(self.post(self.large()).status_code,409)
        response,_=self.create_large();self.assertEqual(response.status_code,201,response.get_json())
        self.assertEqual(response.get_json()['data']['cod_due'],282000)

    def test_fifty_portions_allowed_but_fifty_one_rejected(self):
        with self.sessions.begin() as db:
            dish=db.get(Dish,'rice');dish.price=5000;dish.base_price=0
        p=self.payload();p['items']=[{'dish_id':'rice','quantity':51}]
        self.assertEqual(self.quote(p).status_code,422)
        p['items']=[{'dish_id':'rice','quantity':26},{'dish_id':'rice','quantity':25}]
        self.assertEqual(self.quote(p).get_json()['errors'][0]['code'],'EX-06')
        p['items']=[{'dish_id':'rice','quantity':50}]
        q=self.quote(p);self.assertEqual(q.status_code,200,q.get_json())
        pricing=q.get_json()['data']['bulk_pricing']
        self.assertEqual(pricing['eligible_servings'],50)
        self.assertEqual(pricing['discount_rate'],12)
        self.assertEqual(Decimal(pricing['total_amount']),220000)
        r=self.post(p);self.assertEqual(r.status_code,201,r.get_json())
        self.assertEqual(r.get_json()['data']['items'][0]['quantity'],50)

    def test_tampered_changed_wrong_user_and_replayed_deposit(self):
        token=self.quote().get_json()['data']['deposit_token']
        for field,value in [('recipient_name','Khách khác'),('items',[{'dish_id':'premium','quantity':9}])]:
            p=self.large();p['deposit_token']=token;p[field]=value
            self.assertEqual(self.post(p).status_code,409)
        p=self.large();p['deposit_token']=token;p['items']=[{'dish_id':'premium','quantity':8}]
        self.assertEqual(self.post(p).status_code,409)
        p=self.large();p['deposit_token']=token
        self.assertEqual(self.post(p,user=2).status_code,409)
        p['deposit_token']=token[:-4]+'xxxx';self.assertEqual(self.post(p).status_code,409)
        p['deposit_token']=token;self.assertEqual(self.post(p).status_code,201)
        with self.sessions.begin() as db:db.query(Order).update({'status':'HOAN_THANH'})
        self.assertEqual(self.post(p).get_json()['errors'][0]['code'],'DEPOSIT_ALREADY_USED')

    def test_expired_wrong_purpose_and_changed_price_invalidate_confirmation(self):
        token=self.quote().get_json()['data']['deposit_token'];claims=decode_token(token)
        for update in [{'exp':0},{'type':'access'}]:
            p=self.large();p['deposit_token']=jwt.encode({**claims,**update},settings.SECRET_KEY,algorithm=settings.JWT_ALGORITHM)
            self.assertEqual(self.post(p).status_code,409)
        with self.sessions.begin() as db:db.get(Dish,'premium').price=61000
        p=self.large();p['deposit_token']=token
        self.assertEqual(self.post(p).status_code,409)

    def test_concurrent_confirmations_create_exactly_one_order(self):
        p=self.large();p['deposit_token']=self.quote().get_json()['data']['deposit_token']
        with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(lambda _:self.post(p).status_code,range(2)))
        self.assertEqual(statuses.count(201),1)
        with self.sessions() as db:self.assertEqual(db.query(Order).count(),1)

    def test_timeout_cancels_simulated_deposit_no_refund(self):
        response,_=self.create_large();order_id=response.get_json()['data']['id']
        with self.sessions.begin() as db:db.get(Order,order_id).created_at=datetime.now(timezone.utc)-timedelta(minutes=11)
        token=fixtures.create_access_token({'sub':'1','role':'customer'})
        with self.app.test_client() as c:r=c.get(f'/api/v1/orders/{order_id}',headers={'Authorization':f'Bearer {token}'})
        self.assertEqual(r.get_json()['data']['status'],'TU_DONG_HUY')
        self.assertEqual(r.get_json()['data']['bulk_pricing']['deposit_status'],'cancelled')

    def test_chatbot_large_order_redirects_without_bypassing_deposit(self):
        ChatOrderDraft.__table__.create(self.engine,checkfirst=True);ChatDeliveryPreference.__table__.create(self.engine,checkfirst=True)
        with self.sessions.begin() as db:
            _,action=prepare_draft(db,lock_customer(db,1),'bulk',dict(items=[{'dish_id':'premium','quantity':10}],order_type='pickup',notes_confirmed=True,is_preorder=False))
        self.assertEqual(action['type'],'ORDER_CHECKOUT_REQUIRED')
        with self.sessions.begin() as db:
            _,confirmed=confirm_draft(db,lock_customer(db,1),'bulk',action['draft_id'],action['revision'])
            self.assertEqual(confirmed['type'],'ORDER_CHECKOUT_REQUIRED');self.assertEqual(db.query(Order).count(),0)

    def test_explicit65_catalog_and_combo_counts(self):
        sample=(Path(__file__).resolve().parents[2]/'database/sample_data.sql').read_text(encoding='utf-8')
        seed=sample.split('-- BULK_SERVINGS_SEED_BEGIN\n')[1].split('-- BULK_SERVINGS_SEED_END')[0]
        counts={slug:int(count) for count,slug in re.findall(r"eligible_servings=(\d+) WHERE id='([^']+)'",seed)}
        self.assertEqual(len(counts),65)
        self.assertEqual([counts[k] for k in ['combo-2-nguoi','combo-3-nguoi','combo-4-5-nguoi','combo-com-ga-tra-dao','combo-nhom-an-nhe-toi']],[2,3,4,1,5])
        self.assertEqual(counts['pepsi'],1);self.assertEqual(counts['khoai-tay-chien'],1)
        self.assertTrue(all(count > 0 for count in counts.values()))
        with self.sessions.begin() as db:db.add(Dish(id='combo',name='Combo3',price=150000,base_price=145000,eligible_servings=3))
        p=self.payload();p['items']=[{'dish_id':'combo','quantity':4}]
        r=self.quote(p);self.assertEqual(r.status_code,200,r.get_json())
        self.assertEqual(r.get_json()['data']['bulk_pricing']['eligible_servings'],12)

    def test_call_handover_shift_and_report_only_collect_remaining(self):
        response,payload=self.create_large();order_id=response.get_json()['data']['id']
        staff=fixtures.create_access_token({'sub':'3','role':'staff'});headers={'Authorization':f'Bearer {staff}'}
        with self.app.test_client() as c:
            r=c.patch(f'/api/v1/orders/{order_id}/process',json={'action':'accept'},headers=headers)
            self.assertEqual(r.get_json()['errors'][0]['code'],'PHONE_CONFIRMATION_REQUIRED')
            r=c.patch(f'/api/v1/orders/{order_id}/process',json={'action':'accept','phone_confirmed':True},headers=headers)
            self.assertEqual(r.status_code,200,r.get_json())
            r=c.patch(f'/api/v1/orders/{order_id}/status',json={'status':'DANG_GIAO'},headers=headers)
            self.assertEqual(r.status_code,200,r.get_json())
            suffix=response.get_json()['data']['order_code_suffix']
            r=c.post(f'/api/v1/orders/{order_id}/handover',json={'order_code_suffix':suffix},headers=headers)
            self.assertEqual(r.status_code,200,r.get_json())
        with self.sessions() as db:
            o=db.get(Order,order_id);today=o.delivered_at.astimezone(timezone(timedelta(hours=7))).date()
            self.assertEqual(calculate_staff_shift_orders(db,3,today),(1,Decimal(282000),Decimal(0)))
            report=get_revenue_report(db,today,today)
            self.assertEqual(report['actual_cod_collected'],282000)
            self.assertEqual(report['simulated_deposit_total'],282000)
            self.assertEqual(report['canteen_net_revenue'],514000)
            self.assertEqual(report['system_fee_total'],50000)

    def test_cancellation_marks_simulated_deposit_cancelled(self):
        response,_=self.create_large();order_id=response.get_json()['data']['id']
        token=fixtures.create_access_token({'sub':'1','role':'customer'})
        with self.app.test_client() as c:
            r=c.post(f'/api/v1/orders/{order_id}/cancel',headers={'Authorization':f'Bearer {token}'})
        self.assertEqual(r.get_json()['data']['bulk_pricing']['deposit_status'],'cancelled')

    def test_drinks_count_towards_servings_and_full_discount_base(self):
        with self.sessions.begin() as db:db.add(Dish(id='drink',name='Tea',price=10000,base_price=5000,eligible_servings=1))
        p=self.payload();p['items']=[{'dish_id':'rice','quantity':10},{'dish_id':'drink','quantity':2}]
        r=self.post(p);self.assertEqual(r.status_code,201,r.get_json())
        q=r.get_json()['data']['bulk_pricing']
        self.assertEqual(q['eligible_servings'],12);self.assertEqual(Decimal(q['discount_amount']),22200)

    def test_snack_quantities_across_duplicate_lines_get_freeship(self):
        with self.sessions.begin() as db:
            db.add_all([Dish(id='snack',name='Nem',price=35000,base_price=30000,eligible_servings=1),
                        Dish(id='salad',name='Bánh tráng',price=20000,base_price=15000,eligible_servings=1)])
        p=self.payload();p['items']=[{'dish_id':'snack','quantity':2},{'dish_id':'salad','quantity':1},
                                   {'dish_id':'snack','quantity':1},{'dish_id':'rice','quantity':1}]
        q=self.quote(p);self.assertEqual(q.status_code,200,q.get_json())
        pricing=q.get_json()['data']['bulk_pricing']
        self.assertEqual(pricing['eligible_servings'],5)
        self.assertEqual(Decimal(pricing['shipping_fee']),0)
        self.assertEqual(Decimal(pricing['discount_amount']),0)
        r=self.post(p);self.assertEqual(r.status_code,201,r.get_json())
        self.assertEqual(r.get_json()['data']['bulk_pricing']['eligible_servings'],5)
