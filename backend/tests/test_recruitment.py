"""Integration tests: disposable PostgreSQL *_orders_test only."""
import os
import unittest
from pathlib import Path
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from flask import Flask
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.core.security import create_access_token
from app.core.limiter import limiter
from app.db.models import User
from app.db.recruitment_models import RecruitmentApplication, EmployeeProfile, PersonnelAudit
from app.routes.recruitment import recruitment_bp


class RecruitmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url=os.environ.get('TEST_DATABASE_URL')
        if not url:
            raise unittest.SkipTest('TEST_DATABASE_URL required')
        if make_url(url).get_backend_name()!='postgresql' or not make_url(url).database.endswith('_orders_test'):
            raise RuntimeError('Disposable *_orders_test PostgreSQL required')
        cls.engine=create_engine(url)
        cls.sessions=sessionmaker(bind=cls.engine)
        with cls.engine.begin() as conn:
            conn.execute(text('DROP TABLE IF EXISTS personnel_audit, employee_profiles, recruitment_applications CASCADE'))
            sql=(Path(__file__).resolve().parents[2]/'database/migrations/008_recruitment.sql').read_text(encoding='utf-8')
            conn.exec_driver_sql(sql.replace('BEGIN;','').replace('COMMIT;',''))
            article_sql=(Path(__file__).resolve().parents[2]/'database/migrations/010_articles.sql').read_text(encoding='utf-8')
            conn.exec_driver_sql(article_sql.replace('BEGIN;','').replace('COMMIT;','').replace('%','%%'))
        cls.app=Flask(__name__)
        cls.app.config.update(TESTING=True,RATELIMIT_ENABLED=False)
        limiter.init_app(cls.app)
        cls.app.register_blueprint(recruitment_bp,url_prefix='/api/v1/recruitment')
        @contextmanager
        def test_db():
            with cls.sessions.begin() as db:
                yield db
        for target in ('app.db.session.get_db','app.routes.recruitment.get_db'):
            hook=patch(target,test_db);hook.start();cls.addClassCleanup(hook.stop)
        hook=patch('app.crud.user.is_redis_revoked',return_value=False);hook.start();cls.addClassCleanup(hook.stop)
        cls.addClassCleanup(cls.engine.dispose)

    def setUp(self):
        with self.engine.begin() as conn:
            conn.execute(text('TRUNCATE users, employee_profiles, personnel_audit RESTART IDENTITY CASCADE'))
            conn.execute(text("INSERT INTO recruitment_positions(position,is_open,version) VALUES ('shipper',true,1),('packing',true,1),('customer_support',true,1),('communications',true,1) ON CONFLICT(position) DO UPDATE SET is_open=true,version=1"))
        with self.sessions.begin() as db:
            for i,role in enumerate(('customer','manager','staff','admin'),1):
                db.add(User(id=i,email=f'recruit-{i}@example.com',full_name=f'Nhân sự {i}',phone_number='0977112233',password_hash='unused',role=role))
            db.add(User(id=5,email='inactive@example.com',full_name='Inactive',phone_number='0977112233',password_hash='unused',role='staff',is_active=False))

    def payload(self,**changes):
        return dict(full_name='Nguyễn An',email='applicant@example.com',phone='0977112233',student_id='11210001',position='shipper',availability=['mon-morning','mon-afternoon','wed-morning','fri-afternoon'],intro='Kinh nghiệm',**changes)

    def request(self,method,path='',data=None,user=None,role=None):
        headers={}
        if user:
            headers['Authorization']='Bearer '+create_access_token({'sub':str(user),'role':role or {1:'customer',2:'manager',3:'staff',4:'admin'}[user]})
        with self.app.test_client() as client:
            return client.open('/api/v1/recruitment'+path,method=method,json=data,headers=headers)

    def submit(self,payload=None):
        return self.request('POST','/applications',payload or self.payload())

    def test_public_persists_and_receipt_hides_private_fields(self):
        r=self.submit();self.assertEqual(r.status_code,201,r.get_json())
        self.assertEqual(set(r.get_json()['data']),{'id','created_at'})
        with self.sessions() as db:
            item=db.get(RecruitmentApplication,r.get_json()['data']['id'])
            self.assertEqual(item.availability,self.payload()['availability'])
            self.assertEqual(item.status,'pending');self.assertEqual(item.student_id,'11210001')
            self.assertEqual(db.query(User).count(),5)

    def test_invalid_schedule_and_fields(self):
        changes=[{'availability':[]},{'availability':['mon-morning']*4},
                 {'availability':['sun-morning','mon-morning','tue-morning','wed-morning']},
                 {'availability':['mon-morning','tue-morning','wed-morning']},
                 {'availability':['mon-morning']*13},{'student_id':'   '},{'phone':'1234567890'},
                 {'email':'invalid'},{'position':'manager'},{'internal_note':'injected'},
                 {'status':'hired'},{'intro':'x'*2001},{'full_name':' '},{'student_id':'X'*31}]
        for update in changes:
            p=self.payload();p.update(update)
            with self.subTest(update=update):self.assertEqual(self.submit(p).status_code,422)
        with self.app.test_client() as c:
            self.assertEqual(c.post('/api/v1/recruitment/applications',json=[]).status_code,400)
        with self.sessions() as db:self.assertEqual(db.query(RecruitmentApplication).count(),0)

    def test_minimum_four_maximum_twelve_and_canonical_student(self):
        p=self.payload();p['student_id']=' ab11210001 '
        first=self.submit(p);self.assertEqual(first.status_code,201)
        p['student_id']='AB11210001';p['position']='packing'
        self.assertEqual(self.submit(p).status_code,409)
        p['student_id']='11210002';p['availability']=[f'{day}-{shift}' for day in ('mon','tue','wed','thu','fri','sat') for shift in ('morning','afternoon')]
        self.assertEqual(self.submit(p).status_code,201)

    def test_concurrent_submissions_one_open_application(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda _:self.submit().status_code,range(2)))
        self.assertEqual(sorted(statuses),[201,409])
        with self.sessions() as db:self.assertEqual(db.query(RecruitmentApplication).count(),1)

    def test_manager_only_access_and_current_role_check(self):
        id=self.submit().get_json()['data']['id']
        for user in (None,1,3,4):
            for path in ('/applications','/applications/'+id,'/employees'):
                with self.subTest(user=user,path=path):self.assertEqual(self.request('GET',path,user=user).status_code,401 if user is None else 403)
            self.assertEqual(self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':1},user=user).status_code,401 if user is None else 403)
        with self.sessions.begin() as db:db.get(User,2).role='staff'
        self.assertEqual(self.request('GET','/applications',user=2,role='manager').status_code,403)
        self.assertEqual(self.request('GET','/applications',user=999,role='manager').status_code,403)

    def test_employee_profiles_are_independent_and_manageable(self):
        p={'full_name':'Nhân viên thử nghiệm','position':'chef','employment_status':'active','notes':'Ca sáng'}
        r=self.request('POST','/employees',p,user=2);self.assertEqual(r.status_code,201,r.get_json())
        employee=r.get_json()['data'];self.assertNotIn('password_hash',employee)
        self.assertEqual(len(self.request('GET','/employees?status=active',user=2).get_json()['data']),1)
        p.update(employment_status='resigned',expected_version=employee['version'])
        r=self.request('PATCH','/employees/'+employee['id'],p,user=2);self.assertEqual(r.status_code,200)
        self.assertEqual(self.request('PATCH','/employees/'+employee['id'],p,user=2).status_code,409)
        self.assertEqual(len(self.request('GET','/employees?status=active',user=2).get_json()['data']),0)
        self.assertEqual(len(self.request('GET','/employees?status=resigned',user=2).get_json()['data']),1)
        with self.sessions() as db:self.assertEqual(db.query(User).count(),5)
        self.assertEqual(self.request('POST','/employees',{'full_name':'A','position':'admin'},user=2).status_code,422)
        for user in (None,1,3,4):
            self.assertEqual(self.request('POST','/employees',p,user=user).status_code,401 if user is None else 403)
            self.assertEqual(self.request('PATCH','/employees/'+employee['id'],p,user=user).status_code,401 if user is None else 403)

    def test_seed_sixteen_active_five_resigned_no_accounts(self):
        seed=(Path(__file__).resolve().parents[2]/'database/employee_sample_data.sql').read_text(encoding='utf-8')
        with self.engine.begin() as conn:
            conn.exec_driver_sql(seed);conn.exec_driver_sql(seed)
        with self.sessions() as db:
            self.assertEqual(db.query(EmployeeProfile).filter_by(employment_status='active').count(),16)
            self.assertEqual(db.query(EmployeeProfile).filter_by(employment_status='resigned').count(),5)
            for position in ('kitchen_assistant','chef','cashier'):
                self.assertEqual(db.query(EmployeeProfile).filter_by(employment_status='active',position=position).count(),4)
            self.assertEqual(db.query(User).count(),5)

    def test_status_note_version_and_resubmission_after_terminal(self):
        id=self.submit().get_json()['data']['id']
        update=lambda data:self.request('PATCH','/applications/'+id,data,user=2)
        self.assertEqual(update({'status':'hired','expected_version':1}).status_code,409)
        r=update({'status':'contacting','expected_version':1,'internal_note':'Gọi thứ Hai'});self.assertEqual(r.status_code,200,r.get_json())
        self.assertEqual(self.submit().status_code,409)
        self.assertEqual(update({'status':'rejected','expected_version':1}).status_code,409)
        detail=self.request('GET','/applications/'+id,user=2).get_json()['data']
        self.assertEqual(detail['internal_note'],'Gọi thứ Hai');self.assertEqual(detail['reviewed_by'],2)
        r=update({'status':'hired','expected_version':2,'internal_note':'Đã trao đổi'});self.assertEqual(r.status_code,200)
        self.assertEqual(update({'status':'pending','expected_version':3}).status_code,409)
        self.assertEqual(self.submit().status_code,201)
        with self.sessions() as db:self.assertEqual(db.get(User,1).role,'customer')

    def test_list_filter_pagination_and_bad_update(self):
        self.submit()
        p=self.payload();p['student_id']='11210002';self.submit(p)
        r=self.request('GET','/applications?limit=1&page=2&status=pending',user=2)
        self.assertEqual(r.status_code,200);self.assertEqual(r.get_json()['data']['total'],2)
        self.assertEqual(len(r.get_json()['data']['items']),1)
        for query in ('?limit=0','?page=0','?page=abc','?status=unknown'):
            self.assertEqual(self.request('GET','/applications'+query,user=2).status_code,400)
        self.assertEqual(self.request('GET','/applications/missing',user=2).status_code,404)
        id=self.request('GET','/applications',user=2).get_json()['data']['items'][0]['id']
        self.assertEqual(self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':True},user=2).status_code,422)
        self.assertEqual(self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':1,'internal_note':'x'*2001},user=2).status_code,422)

    def test_concurrent_updates_cannot_overwrite_notes(self):
        id=self.submit().get_json()['data']['id']
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda n:self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':1,'internal_note':str(n)},user=2).status_code,range(2)))
        self.assertEqual(sorted(statuses),[200,409])

    def test_rejection_requires_reason(self):
        id=self.submit().get_json()['data']['id']
        self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':1},user=2)
        r=self.request('PATCH','/applications/'+id,{'status':'rejected','expected_version':2,'internal_note':'   '},user=2)
        self.assertEqual(r.status_code,422)
        self.assertEqual(self.submit().status_code,409)
        self.assertEqual(self.request('PATCH','/applications/'+id,{'status':'rejected','expected_version':2,'internal_note':'Không khớp ca'},user=2).status_code,200)

    def test_employ_once_without_account_and_clear_schedule_on_leave(self):
        id=self.submit().get_json()['data']['id']
        data={'full_name':'Nguyễn An','phone':'0977112233','email':'applicant@example.com','student_id':'11210001','position':'shipper','start_date':'2026-11-09','weekly_schedule':['mon-morning','mon-afternoon'],'expected_application_version':1}
        self.assertEqual(self.request('POST','/applications/'+id+'/employee',data,user=2).status_code,409)
        self.request('PATCH','/applications/'+id,{'status':'contacting','expected_version':1},user=2)
        self.request('PATCH','/applications/'+id,{'status':'hired','expected_version':2},user=2)
        data['expected_application_version']=3
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses=list(pool.map(lambda _:self.request('POST','/applications/'+id+'/employee',data,user=2),range(2)))
        self.assertEqual(sorted(r.status_code for r in responses),[201,409])
        employee=next(r for r in responses if r.status_code==201).get_json()['data']
        self.assertEqual(employee['source_application_id'],id)
        self.assertEqual(employee['weekly_schedule'],['mon-morning','mon-afternoon'])
        data.pop('expected_application_version');data.update(expected_version=1,employment_status='on_leave')
        r=self.request('PATCH','/employees/'+employee['id'],data,user=2);self.assertEqual(r.status_code,200,r.get_json())
        self.assertEqual(r.get_json()['data']['weekly_schedule'],[])
        entries=self.request('GET','/audit/employee/'+employee['id'],user=2).get_json()['data']
        self.assertEqual(entries[0]['actor_id'],2)
        self.assertEqual(entries[0]['details']['before']['weekly_schedule'],['mon-morning','mon-afternoon'])
        with self.sessions() as db:self.assertEqual(db.query(User).count(),5)
        self.assertEqual(self.request('POST','/employees',data,user=2).status_code,422)
        data.pop('expected_version');self.assertEqual(self.request('POST','/employees',data,user=2).status_code,409)

    def test_kitchen_fulltime_is_twelve_slots_except_when_on_leave(self):
        for role in ('chef','kitchen_assistant'):
            r=self.request('POST','/employees',{'full_name':'Fulltime thử nghiệm','position':role,'weekly_schedule':['mon-morning']},user=2)
            self.assertEqual(r.status_code,201,r.get_json())
            self.assertEqual(len(r.get_json()['data']['weekly_schedule']),12)
            data={'full_name':'Fulltime thử nghiệm','position':role,'employment_status':'on_leave','expected_version':1,'weekly_schedule':['mon-morning']}
            r=self.request('PATCH','/employees/'+r.get_json()['data']['id'],data,user=2)
            self.assertEqual(r.status_code,200,r.get_json());self.assertEqual(r.get_json()['data']['weekly_schedule'],[])

    def test_filters_weekly_duplicate_and_account_fields_forbidden(self):
        p={'full_name':'Lịch kiểm thử','email':'worker@example.com','position':'chef','weekly_schedule':['mon-morning','fri-afternoon']}
        self.assertEqual(self.request('POST','/employees',p,user=2).status_code,201)
        r=self.request('GET','/employees?q=kiểm&position=chef&shift=morning',user=2)
        self.assertEqual(len(r.get_json()['data']),1)
        self.assertEqual(self.request('GET','/employees?position=cashier',user=2).get_json()['data'],[])
        p['full_name']='Nhân viên khác';p['email']='';p['weekly_schedule']=['mon-morning','mon-morning']
        self.assertEqual(self.request('POST','/employees',p,user=2).status_code,422)
        p['weekly_schedule']=[];p['user_id']=1
        self.assertEqual(self.request('POST','/employees',p,user=2).status_code,422)
        self.submit()
        r=self.request('GET','/applications?position=shipper&shift=morning&q=Nguyễn&from=2020-01-01&to=2030-01-01',user=2)
        self.assertEqual(r.get_json()['data']['total'],1)
        self.assertEqual(self.request('GET','/applications?from=bad',user=2).status_code,400)

if __name__=='__main__':unittest.main()
