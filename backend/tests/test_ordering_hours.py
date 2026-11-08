from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import unittest
from app.crud.order_policy import validate_order_time, OrderError, VIETNAM
from app.schemas.setting import validate_setting_value
from app.schemas.user import UserUpdateRequest
from app.routes.setting import _validate_hours
from app.db.models import User, Order
from app.crud.chat_order import preview, prepare_draft, confirm_draft, lock_customer
from app.db.chat_models import ChatOrderDraft, ChatDeliveryPreference
from app.routes.setting import setting_bp
from contextlib import contextmanager
from manage_order_tester import set_exemption
import test_order_creation as fixtures


def vn(day=9, hour=11, minute=0, second=0, microsecond=0):
    return datetime(2026, 11, day, hour, minute, second, microsecond, tzinfo=VIETNAM)


POLICY = dict(open_time="07:30", order_cutoff_time="18:30", close_time="19:00",
              min_lead_minutes=30, max_days=7, exempt_hours=False)


class OrderingTimeTests(unittest.TestCase):
    def test_sunday_vietnam_boundary_and_next_monday(self):
        with self.assertRaises(OrderError) as error:
            validate_order_time(POLICY,False,None,vn(day=8,hour=0).astimezone(timezone.utc))
        self.assertEqual(error.exception.code,'ORDER_CLOSED_DAY')
        validate_order_time(POLICY,True,vn(day=9,hour=7,minute=30),vn(day=8,hour=11))
        with self.assertRaises(OrderError) as error:
            validate_order_time(POLICY,True,vn(day=8,hour=9),vn(day=7,hour=22))
        self.assertEqual(error.exception.code,'SCHEDULE_CLOSED_DAY')
        with self.assertRaises(OrderError) as error:
            validate_order_time(POLICY,True,vn(day=16,hour=9),vn(day=8,hour=11))
        self.assertEqual(error.exception.code,'SCHEDULE_DATE_RANGE')

    def test_tester_sunday_exception_preserves_lead_and_horizon(self):
        policy={**POLICY,'exempt_hours':True}
        validate_order_time(policy,False,None,vn(day=8,hour=23))
        validate_order_time(policy,True,vn(day=8,hour=23,minute=30),vn(day=8,hour=23))
        for scheduled in [vn(day=8,hour=23,minute=29),vn(day=16,hour=9)]:
            with self.assertRaises(OrderError):validate_order_time(policy,True,scheduled,vn(day=8,hour=23))

    def test_immediate_inclusive_exact_boundaries_without_lead_time(self):
        for moment, allowed in [(vn(hour=7,minute=29,second=59),False), (vn(hour=7,minute=30),True),
                (vn(hour=18,minute=30),True),(vn(hour=18,minute=30,microsecond=1),False), (vn(hour=22),False)]:
            with self.subTest(moment=moment):
                if allowed:
                    validate_order_time(POLICY,False,None,moment)
                else:
                    with self.assertRaisesRegex(OrderError,'Canteen nhận đơn'):
                        validate_order_time(POLICY,False,None,moment)

    def test_outside_creation_hours_preorder_next_day_allowed(self):
        validate_order_time(POLICY,True,vn(day=10,hour=9),vn(hour=22))
        validate_order_time(POLICY,True,vn(hour=7,minute=30),vn(hour=2))

    def test_service_cutoffs_and_minimum_exact_seconds(self):
        for scheduled, code in [(vn(hour=19),None),(vn(hour=19,microsecond=1),'SCHEDULE_OUTSIDE_HOURS'),
                (vn(day=10,hour=7,minute=29),'SCHEDULE_OUTSIDE_HOURS'),
                (vn(hour=18,minute=59,second=59),'EX-08')]:
            with self.subTest(scheduled=scheduled):
                if code:
                    with self.assertRaises(OrderError) as error:
                        validate_order_time(POLICY,True,scheduled,vn(hour=18,minute=30))
                    self.assertEqual(error.exception.code,code)
                else:validate_order_time(POLICY,True,scheduled,vn(hour=18,minute=30))

    def test_seven_vietnam_calendar_days_not_168_hours(self):
        validate_order_time(POLICY,True,vn(day=16,hour=19),vn(hour=7))
        for scheduled in [vn(day=17,hour=7,minute=30),vn(day=8)]:
            with self.assertRaises(OrderError):validate_order_time(POLICY,True,scheduled,vn())
        # UTC17:30 is the next Vietnam calendar day.
        validate_order_time(POLICY,True,vn(day=17,hour=19),vn(day=10,hour=0,minute=30).astimezone(timezone.utc))

    def test_tester_only_exempts_hours(self):
        policy={**POLICY,"exempt_hours":True}
        validate_order_time(policy,False,None,vn(hour=23))
        validate_order_time(policy,True,vn(hour=23,minute=30),vn(hour=23))
        for scheduled in [vn(hour=23,minute=10),vn(day=17,hour=23)]:
            with self.assertRaises(OrderError):validate_order_time(policy,True,scheduled,vn(hour=23))
        with self.assertRaises(OrderError):validate_order_time(policy,False,vn(day=10),vn())

    def test_settings_and_profile_permission_boundaries(self):
        self.assertFalse(validate_setting_value('min_preorder_lead_minutes','29')[0])
        self.assertTrue(validate_setting_value('min_preorder_lead_minutes','45')[0])
        self.assertFalse(validate_setting_value('canteen_order_cutoff_time','25:00')[0])
        with patch('app.routes.setting.get_setting_by_key',side_effect=lambda db,key,default:default):
            self.assertIsNotNone(_validate_hours(None,{'canteen_order_cutoff_time':'20:00'}))
            self.assertIsNone(_validate_hours(None,{'canteen_order_cutoff_time':'19:00'}))
        self.assertNotIn('ordering_hours_exempt',UserUpdateRequest.model_validate({'ordering_hours_exempt':True}).model_dump())


class OrderingHoursIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.OrderCreationTests.setUpClass.__func__(cls)
        ChatOrderDraft.__table__.create(cls.engine, checkfirst=True)
        ChatDeliveryPreference.__table__.create(cls.engine, checkfirst=True)
        cls.app.register_blueprint(setting_bp,url_prefix='/api/v1/settings')
        @contextmanager
        def test_db():
            with cls.sessions() as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise
        cls.settings_patch=patch('app.routes.setting.get_db',test_db)
        cls.settings_patch.start()
        cls.addClassCleanup(cls.settings_patch.stop)

    def setUp(self):
        fixtures.OrderCreationTests.setUp(self)
        self.clock=self.enterContext(patch('app.crud.order.datetime',wraps=datetime))
        self.clock.now.return_value=vn(hour=22).astimezone(timezone.utc)
        self.enterContext(patch('app.crud.user.is_redis_revoked',return_value=False))
        with self.sessions.begin() as db:db.query(User).update({'ordering_hours_exempt':False})

    payload=fixtures.OrderCreationTests.payload
    post=fixtures.OrderCreationTests.post

    def test_sunday_both_fulfillment_types_and_tester_revoke(self):
        self.clock.now.return_value=vn(day=8,hour=11)
        for order_type in ('delivery','pickup'):
            payload=self.payload();payload['order_type']=order_type
            response=self.post(payload)
            self.assertEqual(response.get_json()['errors'][0]['code'],'ORDER_CLOSED_DAY')
        with self.sessions.begin() as db:set_exemption(db,'orders-test-1@example.com',True)
        response=self.post()
        self.assertEqual(response.status_code,201,response.get_json())
        with self.sessions.begin() as db:
            db.query(Order).update({'status':'HOAN_THANH'})
            set_exemption(db,'orders-test-1@example.com',False)
        self.assertEqual(self.post().get_json()['errors'][0]['code'],'ORDER_CLOSED_DAY')

    def test_legacy_sunday_schedule_warns_without_changing_order(self):
        payload=self.payload();payload.update(is_preorder=True,scheduled_at=vn(day=10,hour=9).isoformat())
        response=self.post(payload);self.assertEqual(response.status_code,201,response.get_json())
        order_id=response.get_json()['data']['id']
        with self.sessions.begin() as db:
            order=db.get(Order,order_id);order.scheduled_at=vn(day=15,hour=9);order.status='DANG_CHUAN_BI'
        token=fixtures.create_access_token({'sub':'3','role':'staff'})
        with self.app.test_client() as client:
            response=client.get(f'/api/v1/orders/{order_id}',headers={'Authorization':f'Bearer {token}'})
        self.assertEqual(response.status_code,200,response.get_json())
        self.assertTrue(response.get_json()['data']['sunday_schedule_warning'])
        with self.sessions.begin() as db:
            order=db.get(Order,order_id)
            self.assertEqual(order.status,'DANG_CHUAN_BI')
            self.assertEqual(order.scheduled_at,vn(day=15,hour=9))
            db.get(User,1).ordering_hours_exempt=True
        with self.app.test_client() as client:
            response=client.get(f'/api/v1/orders/{order_id}',headers={'Authorization':f'Bearer {token}'})
        self.assertFalse(response.get_json()['data']['sunday_schedule_warning'])

    def test_sunday_chatbot_preview_rejected_and_monday_allowed(self):
        self.clock.now.return_value=vn(day=8,hour=11)
        args=self.payload();args['items_data']=args.pop('items')
        args.update(delivery_note=None,is_preorder=False,scheduled_at=None,payment_method='cod_cash')
        with self.sessions.begin() as db:
            with self.assertRaises(OrderError) as error:preview(db,1,args)
            self.assertEqual(error.exception.code,'ORDER_CLOSED_DAY')
        args.update(is_preorder=True,scheduled_at=vn(day=9,hour=9))
        with self.sessions.begin() as db:
            self.assertEqual(float(preview(db,1,args)['total_amount']),75000)
            self.assertEqual(db.query(Order).count(),0)

    def test_api_spoofed_tester_flag_and_email_do_not_bypass(self):
        with self.sessions.begin() as db:db.get(User,1).email='tester@neufood.com'
        payload=self.payload();payload.update(ordering_hours_exempt=True,is_tester=True)
        response=self.post(payload)
        self.assertEqual(response.status_code,400,response.get_json())
        self.assertEqual(response.get_json()['errors'][0]['code'],'ORDER_OUTSIDE_HOURS')
        with self.sessions() as db:self.assertEqual(db.query(Order).count(),0)

    def test_api_preorder_after_hours_and_policy_endpoint(self):
        payload=self.payload();payload.update(is_preorder=True,scheduled_at=vn(day=10,hour=9).isoformat())
        self.assertEqual(self.post(payload).status_code,201)
        token=fixtures.create_access_token({'sub':'1','role':'customer'})
        with self.app.test_client() as client:
            response=client.get('/api/v1/orders/policy',headers={'Authorization':f'Bearer {token}'})
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.get_json()['data']['exempt_hours'])
        self.assertEqual(response.get_json()['data']['max_days'],7)

    def test_grant_revoke_immediate_and_one_active_order(self):
        with self.sessions.begin() as db:set_exemption(db,'orders-test-1@example.com',True)
        self.assertEqual(self.post().status_code,201)
        self.assertEqual(self.post().get_json()['errors'][0]['code'],'EX-09')
        with self.sessions.begin() as db:
            db.query(Order).update({'status':'HOAN_THANH'})
            set_exemption(db,'orders-test-1@example.com',False)
        self.assertEqual(self.post().get_json()['errors'][0]['code'],'ORDER_OUTSIDE_HOURS')

    def test_tester_still_checks_cod_quantity_location_blacklist(self):
        with self.sessions.begin() as db:set_exemption(db,'orders-test-1@example.com',True)
        for changes,code in [({'items':[{'dish_id':'premium','quantity':10}]},'DEPOSIT_CONFIRMATION_REQUIRED'),
                ({'items':[{'dish_id':'rice','quantity':26},{'dish_id':'rice','quantity':25}]},'EX-06'),({'campus_location_id':999},'EX-07')]:
            payload=self.payload();payload.update(changes)
            self.assertEqual(self.post(payload).get_json()['errors'][0]['code'],code)
        with self.sessions.begin() as db:db.get(User,1).is_blacklisted=True
        self.assertEqual(self.post().get_json()['errors'][0]['code'],'EX-10')

    def test_chatbot_preview_uses_same_policy_and_no_persisted_order(self):
        args=self.payload();args['items_data']=args.pop('items')
        args.update(delivery_note=None,is_preorder=False,scheduled_at=None,payment_method='cod_cash')
        with self.sessions.begin() as db:
            with self.assertRaises(OrderError) as error:preview(db,1,args)
            self.assertEqual(error.exception.code,'ORDER_OUTSIDE_HOURS')
        args.update(is_preorder=True,scheduled_at=vn(day=10,hour=9))
        with self.sessions.begin() as db:
            self.assertEqual(float(preview(db,1,args)['total_amount']),75000)
            self.assertEqual(db.query(Order).count(),0)

    def test_chatbot_confirmation_rechecks_clock_after_cutoff(self):
        self.clock.now.return_value=vn(hour=18,minute=29)
        with self.sessions.begin() as db:
            _,action=prepare_draft(db,lock_customer(db,1),'hours',dict(items=[{'dish_id':'rice','quantity':1}],
                order_type='pickup',is_preorder=False,notes_confirmed=True))
        self.clock.now.return_value=vn(hour=18,minute=31)
        with self.sessions.begin() as db:
            with self.assertRaises(OrderError) as error:
                confirm_draft(db,lock_customer(db,1),'hours',action['draft_id'],action['revision'])
            self.assertEqual(error.exception.code,'ORDER_OUTSIDE_HOURS')
        with self.sessions() as db:self.assertEqual(db.query(Order).count(),0)

    def test_settings_single_and_bulk_enforce_three_times_and_lead(self):
        token=fixtures.create_access_token({'sub':'5','role':'admin'})
        headers={'Authorization':f'Bearer {token}'}
        with self.app.test_client() as client:
            for key,value in [('canteen_order_cutoff_time','20:00'),('min_preorder_lead_minutes','29')]:
                response=client.put(f'/api/v1/settings/{key}',json={'setting_value':value},headers=headers)
                self.assertEqual(response.status_code,422,response.get_json())
            invalid=[{'setting_key':'canteen_open_time','setting_value':'19:00'},
                     {'setting_key':'canteen_order_cutoff_time','setting_value':'18:30'}]
            response=client.put('/api/v1/settings/bulk',json={'settings':invalid},headers=headers)
            self.assertEqual(response.status_code,422,response.get_json())
            valid=[{'setting_key':k,'setting_value':v} for k,v in [('canteen_open_time','08:00'),
                ('canteen_order_cutoff_time','18:00'),('canteen_close_time','18:30'),('min_preorder_lead_minutes','45')]]
            response=client.put('/api/v1/settings/bulk',json={'settings':valid},headers=headers)
            self.assertEqual(response.status_code,200,response.get_json())
