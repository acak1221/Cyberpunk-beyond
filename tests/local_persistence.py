import urllib.request, http.cookiejar,json
base='http://127.0.0.1:5188'; jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));opener.open(base+'/signin-with-chatgpt?return_to=/',timeout=10)
with opener.open(base+'/api/state',timeout=10) as r: data=json.load(r)
assert data['revision']>=1 and data['data']['characters'][0]['id']=='test-character',data
print('Local D1 persisted revision',data['revision'],'and character.')
