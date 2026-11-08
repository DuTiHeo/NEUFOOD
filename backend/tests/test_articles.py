import unittest
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
import test_recruitment as fixtures
from app.routes.article import article_bp
from app.db.article_models import Article,RecruitmentPosition
from app.core.security import create_access_token
from app.schemas.article import ArticleContent
from pydantic import ValidationError


class ArticleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.RecruitmentTests.setUpClass.__func__(cls)
        cls.app.register_blueprint(article_bp,url_prefix='/api/v1/articles')
        hook=patch('app.routes.article.get_db',__import__('app.routes.recruitment',fromlist=['get_db']).get_db)
        hook.start();cls.addClassCleanup(hook.stop)
    def setUp(self):fixtures.RecruitmentTests.setUp(self)
    def req(self,method,path='',data=None,user=None,role=None):
        headers={}
        if user:headers['Authorization']='Bearer '+create_access_token({'sub':str(user),'role':role or {1:'customer',2:'manager',3:'staff',4:'admin'}.get(user,'manager')})
        with self.app.test_client() as c:return c.open('/api/v1/articles'+path,method=method,json=data,headers=headers)
    def content(self,title='Bài kiểm thử'):
        return {'title':title,'summary':'Giới thiệu','cover_url':'','body':{'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'Nội dung <script>alert(1)</script>'}]}]},'recruitment_roles':[]}
    def create(self,kind='news',content=None):
        r=self.req('POST','/manage',{'kind':kind,'content':content or self.content()},user=2)
        self.assertEqual(r.status_code,201,r.get_json());return r.get_json()['data']
    def publish(self,a,user=2):return self.req('POST',f"/manage/{a['id']}/publish",{'expected_version':a['version']},user=user)

    def test_draft_private_and_save_does_not_replace_published(self):
        a=self.create();self.assertEqual(self.req('GET','/'+a['id']).status_code,404)
        p=self.publish(a);self.assertEqual(p.status_code,200,p.get_json());a=p.get_json()['data']
        self.assertNotIn('draft',self.req('GET','/'+a['id']).get_json()['data'])
        r=self.req('PUT','/manage/'+a['id'],{'expected_version':a['version'],'content':self.content('Nội dung mới')},user=2)
        self.assertEqual(r.status_code,200,r.get_json())
        self.assertEqual(self.req('GET','/'+a['id']).get_json()['data']['content']['title'],'Bài kiểm thử')
        a=r.get_json()['data'];self.assertEqual(self.publish(a).status_code,200)
        self.assertEqual(self.req('GET','/'+a['id']).get_json()['data']['content']['title'],'Nội dung mới')

    def test_public_only_published_filter_and_hide(self):
        a=self.create();a=self.publish(a).get_json()['data'];self.create()
        listed=self.req('GET','?kind=news&limit=1').get_json()['data'];self.assertEqual(listed['total'],1)
        r=self.req('POST',f"/manage/{a['id']}/hide",{'expected_version':a['version']},user=2);self.assertEqual(r.status_code,200)
        self.assertEqual(self.req('GET','/'+a['id']).status_code,404)
        self.assertEqual(self.req('GET','').get_json()['data']['total'],0)

    def test_permissions_current_database_role(self):
        a=self.create()
        for user in (None,1,3):
            for method,path,data in [('GET','/manage',None),('GET','/manage/'+a['id'],None),('POST','/manage',{'kind':'news','content':self.content()})]:
                self.assertEqual(self.req(method,path,data,user=user).status_code,401 if user is None else 403)
        self.assertEqual(self.req('POST','/manage',{'kind':'news','content':self.content()},user=4).status_code,403)
        self.assertEqual(self.publish(a,user=4).status_code,403)
        with self.sessions.begin() as db:db.get(fixtures.User,2).role='staff'
        self.assertEqual(self.req('GET','/manage',user=2,role='manager').status_code,403)
        self.assertEqual(self.req('GET','/manage',user=999).status_code,403)

    def test_admin_reason_block_and_release(self):
        a=self.publish(self.create()).get_json()['data']
        path=f"/manage/{a['id']}"
        self.assertEqual(self.req('POST',path+'/hide',{'expected_version':a['version']},user=4).status_code,422)
        a=self.req('POST',path+'/hide',{'expected_version':a['version'],'reason':'Nội dung cần kiểm tra'},user=4).get_json()['data']
        self.assertEqual(self.publish(a).status_code,403)
        self.assertEqual(self.req('POST',path+'/hide',{'expected_version':a['version']},user=2).status_code,403)
        self.assertEqual(self.req('POST',path+'/release',{'expected_version':a['version']},user=2).status_code,403)
        a=self.req('POST',path+'/release',{'expected_version':a['version']},user=4).get_json()['data']
        self.assertEqual(self.publish(a).status_code,200)

    def test_version_prevents_concurrent_draft_overwrite(self):
        a=self.create()
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda n:self.req('PUT','/manage/'+a['id'],{'expected_version':a['version'],'content':self.content(str(n))},user=2).status_code,range(2)))
        self.assertEqual(sorted(statuses),[200,409])

    def test_race_replaces_featured_atomically(self):
        a=self.create('story');b=self.create('story')
        with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(lambda item:self.publish(item).status_code,[a,b]))
        self.assertEqual(statuses,[200,200])
        with self.sessions() as db:self.assertEqual(db.query(Article).filter_by(kind='story',status='published').count(),1)
        featured=self.req('GET','/featured/story').get_json()['data'];self.assertIn(featured['id'],[a['id'],b['id']])

    def test_recruitment_requires_four_complete_roles(self):
        a=self.create('recruitment');self.assertEqual(self.publish(a).status_code,422)
        content=self.content();content['recruitment_roles']=[{'position':role,'description':'Mô tả'} for role in ('shipper','packing','customer_support','communications')]
        a=self.req('PUT','/manage/'+a['id'],{'expected_version':a['version'],'content':content},user=2).get_json()['data']
        self.assertEqual(self.publish(a).status_code,200)

    def test_closed_position_submit_rejected_and_hide_is_independent(self):
        a=self.publish(self.create()).get_json()['data']
        r=self.req('PATCH','/positions/shipper',{'expected_version':1,'is_open':False},user=2);self.assertEqual(r.status_code,200)
        response=fixtures.RecruitmentTests.submit(self)
        self.assertEqual(response.status_code,409,response.get_json())
        self.assertEqual(response.get_json()['errors'][0]['code'],'POSITION_CLOSED')
        self.req('POST',f"/manage/{a['id']}/hide",{'expected_version':a['version']},user=2)
        setting=next(p for p in self.req('GET','/recruitment-settings').get_json()['data']['positions'] if p['position']=='shipper');self.assertFalse(setting['is_open'])
        self.assertEqual(self.req('PATCH','/positions/shipper',{'expected_version':1,'is_open':True},user=2).status_code,409)
        self.assertEqual(self.req('PATCH','/positions/shipper',{'expected_version':2,'is_open':True},user=2).status_code,200)

    # Helpers for public recruitment fixture used above.
    payload=fixtures.RecruitmentTests.payload
    request=fixtures.RecruitmentTests.request

    def test_unsafe_documents_links_images_and_size(self):
        invalid=[{'type':'script'}, {'type':'doc','content':[{'type':'image','attrs':{'src':'javascript:alert(1)'}}]},
                 {'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'x','marks':[{'type':'link','attrs':{'href':'data:text/html,test'}}]}]}]},
                 {'type':'doc','content':[{'type':'heading','attrs':{'level':1}}]},
                 {'type':'doc','content':[{'type':'doc','content':[]}]},
                 {'type':'doc','content':[{'type':'paragraph','content':[{'type':'heading','attrs':{'level':2}}]}]}]
        for doc in invalid:
            with self.subTest(doc=doc),self.assertRaises(ValidationError):ArticleContent.model_validate({'body':doc})
        self.assertEqual(self.req('POST','/manage',{'kind':'news','content':{**self.content(),'cover_url':'javascript:test'}},user=2).status_code,422)
        for href in ('//evil.test/image','data:image/svg+xml,x','https://user:pass@evil.test/a'):
            with self.assertRaises(ValidationError):ArticleContent.model_validate({'cover_url':href})
        a=self.create();self.assertEqual(self.req('PUT','/manage/'+a['id'],{'expected_version':True,'content':self.content()},user=2).status_code,422)

    def test_upload_rejects_fake_raster_and_script(self):
        token=create_access_token({'sub':'2','role':'manager'})
        with self.app.test_client() as client:
            r=client.post('/api/v1/articles/images',data={'file':(BytesIO(b'<script>bad</script>'),'fake.png')},headers={'Authorization':'Bearer '+token})
            self.assertEqual(r.status_code,422,r.get_json())

    def test_history_and_bounds(self):
        a=self.create();self.publish(a)
        h=self.req('GET',f"/manage/{a['id']}/history",user=2).get_json()['data'];self.assertEqual([e['action'] for e in h],['publish','create'])
        self.assertEqual(self.req('GET',f"/manage/{a['id']}/history").status_code,401)
        for query in ('?page=0','?limit=101','?kind=invalid'):
            self.assertEqual(self.req('GET',query).status_code,400)

if __name__=='__main__':unittest.main()
