import httpx, pathlib, json, sys
BASE="http://127.0.0.1:8000"
def run():
    email="e2e_test@decentra.ai"
    pw="demo1234"
    with httpx.Client(timeout=30) as c:
        # register (or login if exists)
        r=c.post(f"{BASE}/api/v1/auth/register", json={"email":email,"password":pw,"full_name":"E2E"})
        if r.status_code==400:
            r=c.post(f"{BASE}/api/v1/auth/login", json={"email":email,"password":pw})
        print("auth:", r.status_code, r.text[:300])
        r.raise_for_status()
        tok=r.json()["access_token"]
        hdr={"Authorization": f"Bearer {tok}"}
        # orgs
        r=c.get(f"{BASE}/api/v1/organizations", headers=hdr)
        print("list orgs:", r.status_code, r.text[:300])
        orgs=r.json()
        if not orgs:
            r=c.post(f"{BASE}/api/v1/organizations", json={"name":"E2E Workspace"}, headers=hdr)
            print("create org:", r.status_code, r.text[:400])
            r.raise_for_status()
            org_id=r.json()["id"]
        else:
            org_id=orgs[0]["id"]
        print("org_id:", org_id)
        # upload
        path=pathlib.Path("samples/sales_demo.csv")
        with open(path,"rb") as f:
            r=c.post(f"{BASE}/api/v1/datasets/upload", headers=hdr, data={"org_id":org_id,"name":"sales_demo"}, files={"file":("sales_demo.csv", f,"text/csv")})
        print("upload:", r.status_code)
        if r.status_code!=200:
            print(r.text[:1000])
            return
        ds=r.json()["dataset"]
        ds_id=ds["id"]
        print("dataset:", ds)
        # quality
        for endpoint in [f"/api/v1/datasets/{ds_id}/quality", f"/api/v1/datasets/{ds_id}/kpis", f"/api/v1/datasets/{ds_id}/analytics/overview", f"/api/v1/datasets/{ds_id}/anomalies", f"/api/v1/datasets/{ds_id}/predictions", f"/api/v1/datasets/{ds_id}/insights", f"/api/v1/datasets/{ds_id}/recommendations"]:
            r=c.get(f"{BASE}{endpoint}", headers=hdr)
            print(endpoint, "=>", r.status_code, r.text[:400].replace("\n"," ")[:400])
        # assistant
        r=c.post(f"{BASE}/api/v1/datasets/{ds_id}/assistant/query", headers=hdr, json={"question":"Why did revenue decline?"})
        print("assistant:", r.status_code)
        print(json.dumps(r.json(), indent=2)[:2000])
        print("\nE2E SUCCESS")
if __name__=="__main__":
    run()
