import urllib.request, urllib.error, http.cookiejar, json
base='http://127.0.0.1:5188'
cookies=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
def call(path,method='GET',data=None,headers=None):
 b=None if data is None else json.dumps(data).encode();req=urllib.request.Request(base+path,data=b,method=method,headers=headers or {})
 try:
  with opener.open(req,timeout=10) as r:return r.status,r.read().decode()
 except urllib.error.HTTPError as ex:return ex.code,ex.read().decode()
status,body=call('/api/state');assert status==401,(status,body)
status,body=call('/signin-with-chatgpt?return_to=/');assert status==200,(status,body)
status,body=call('/api/state');assert status==200,(status,body)
result=json.loads(body);revision=result['revision'];scope=result['scope'];assert len(scope)==68 and scope.startswith('nc1_') and 'seedy' not in scope
state={'lang':'ru','characters':[{'id':'test-character','name':'Test','stats':{'BODY':8,'WILL':6},'skills':{'Athletics':2}}],'campaigns':[],'history':[]}
status,body=call('/api/state','PUT',{'scope':scope,'revision':revision,'data':state},{'Origin':base,'Content-Type':'application/json'});assert status==(201 if revision==0 else 200),(status,body)
status,body=call('/api/state','PUT',{'scope':scope,'revision':revision,'data':state},{'Origin':base,'Content-Type':'application/json'});assert status==409 and json.loads(body)['error']=='revision_conflict',(status,body)
status,body=call('/api/state','PUT',{'scope':'nc1_'+('0'*64),'revision':revision+1,'data':state},{'Origin':base,'Content-Type':'application/json'});assert status==409 and json.loads(body)['error']=='account_changed',(status,body)
status,body=call('/api/state');assert status==200 and json.loads(body)['data']==state and json.loads(body)['scope']==scope,(status,body)
print('Local Vinext + mock-auth + local D1: anonymous 401, sign-in, CAS write, stale 409, read 200 passed; revision',revision+1)
