"""
Test Suite: Live Network Verification for backend/app/routes/order.py
NEUFood Quality Assurance - Real Network & PostgreSQL Gate Testing
"""
import sys
import os
import json
import time
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import engine

BASE_URL = "http://127.0.0.1:5000/api/v1"

results = []

def record(test_id, name, layer, expected, actual, passed, details=""):
    results.append({
        "id": test_id,
        "name": name,
        "layer": layer,
        "expected": expected,
        "actual": actual,
        "status": "PASS" if passed else "FAIL",
        "details": details
    })
    status_str = "\033[92mPASS\033[0m" if passed else "\033[91mFAIL\033[0m"
    print(f"[{status_str}] {test_id}: {name} -> {actual}")
    if not passed and details:
        print(f"    ERROR DETAILS: {details}")

def http_request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.status
            body_text = response.read().decode("utf-8")
            try:
                parsed = json.loads(body_text)
            except Exception:
                parsed = {"raw": body_text}
            return status_code, parsed
    except urllib.error.HTTPError as e:
        status_code = e.code
        body_text = e.read().decode("utf-8")
        try:
            parsed = json.loads(body_text)
        except Exception:
            parsed = {"raw": body_text}
        return status_code, parsed

def login(email, password):
    status, res = http_request("POST", "/auth/login", {"email": email, "password": password})
    if status == 200:
        return res["data"]["access_token"]
    raise RuntimeError(f"Login failed for {email}: {status} {res}")

def register_user(email, phone, name="Test User"):
    payload = {
        "email": email,
        "password": "password123",
        "full_name": name,
        "phone_number": phone,
        "student_id": f"ST{int(time.time()*1000)%10000000:07d}"
    }
    status, res = http_request("POST", "/auth/register", payload)
    if status in (201, 200):
        return res["data"]["access_token"]
    # If user already registered, try logging in
    return login(email, "password123")

def run_tests():
    print("=" * 70)
    print("STARTING LIVE REAL NETWORK TESTS ON http://127.0.0.1:5000/api/v1")
    print("=" * 70)

    # 1. Obtain Tokens
    ts = int(time.time())
    staff_token = login("shipper01@neufood.vn", "password123")
    manager_token = login("manager.a2@neufood.vn", "password123")
    admin_token = login("admin@neufood.vn", "password123")
    cust1_email = f"cust1_{ts}@neu.edu.vn"
    cust1_token = register_user(cust1_email, f"097{ts%10000000:07d}", "Khách Hàng 1")

    # =========================================================================
    # LỚP 1: LUỒNG CHUẨN (HAPPY PATH)
    # =========================================================================
    print("\n--- LỚP 1: LUỒNG CHUẨN (HAPPY PATH) ---")

    # TC-01: Tạo đơn delivery COD
    order1_payload = {
        "order_type": "delivery",
        "recipient_name": "Khách Hàng 1",
        "recipient_phone": "0977112233",
        "campus_location_id": 1,
        "room_detail": "Phòng 502 Nhà A1",
        "delivery_note": "Giao tận tay",
        "is_preorder": False,
        "payment_method": "cod_cash",
        "items": [
            {"dish_id": "pho-bo-tai-lan", "quantity": 1}
        ]
    }
    status1, res1 = http_request("POST", "/orders", order1_payload, cust1_token)
    order1_data = res1.get("data", {}) if status1 == 201 else {}
    order1_id = order1_data.get("id")
    order1_suffix = order1_data.get("order_code_suffix")
    p1 = (
        status1 == 201 and 
        order1_data.get("status") == "CHO_XAC_NHAN" and
        order1_data.get("subtotal_amount") == 50000.0 and
        order1_data.get("ship_fee") == 5000.0 and
        order1_data.get("total_amount") == 55000.0 and
        order1_data.get("payment_status") == "chua_thanh_toan" and
        len(order1_suffix or "") == 4
    )
    record("TC-01", "POST /orders - Tạo đơn Delivery COD thành công", "Lớp 1", "201 Created, total=55k, status=CHO_XAC_NHAN", f"{status1}, total={order1_data.get('total_amount')}", p1, json.dumps(res1))

    # TC-02: GET /orders/<id> - Khách xem chi tiết đơn
    status2, res2 = http_request("GET", f"/orders/{order1_id}", token=cust1_token)
    d2 = res2.get("data", {})
    p2 = status2 == 200 and d2.get("id") == order1_id and len(d2.get("items", [])) == 1
    record("TC-02", f"GET /orders/<id> - Khách xem chi tiết đơn hàng", "Lớp 1", "200 OK, đúng order_id và items", f"{status2}, items_count={len(d2.get('items', []))}", p2, json.dumps(res2))

    # TC-03: GET /orders - Khách xem danh sách đơn của mình
    status3, res3 = http_request("GET", "/orders", token=cust1_token)
    d3 = res3.get("data", [])
    p3 = status3 == 200 and any(o.get("id") == order1_id for o in d3)
    record("TC-03", "GET /orders - Khách xem lịch sử đơn hàng", "Lớp 1", "200 OK, danh sách chứa order vừa tạo", f"{status3}, total_orders={len(d3)}", p3, json.dumps(res3))

    # TC-04: GET /orders/admin/all - Staff xem toàn bộ đơn
    status4, res4 = http_request("GET", "/orders/admin/all?status=CHO_XAC_NHAN&page=1&limit=20", token=staff_token)
    d4 = res4.get("data", {})
    items4 = d4.get("items", [])
    p4 = status4 == 200 and any(o.get("id") == order1_id for o in items4)
    record("TC-04", "GET /orders/admin/all - Staff xem danh sách đơn lọc theo status", "Lớp 1", "200 OK, chứa order1", f"{status4}, count={len(items4)}", p4, json.dumps(res4))

    # TC-05: PATCH /orders/<id>/process - Staff duyệt nhận đơn (accept)
    status5, res5 = http_request("PATCH", f"/orders/{order1_id}/process", {"action": "accept"}, token=staff_token)
    d5 = res5.get("data", {})
    p5 = status5 == 200 and d5.get("status") == "DANG_CHUAN_BI" and d5.get("staff_id") is not None
    record("TC-05", "PATCH /orders/<id>/process (accept) - Duyệt nhận đơn", "Lớp 1", "200 OK, status=DANG_CHUAN_BI", f"{status5}, status={d5.get('status')}", p5, json.dumps(res5))

    # TC-06: PATCH /orders/<id>/status - Staff chuyển DANG_GIAO
    status6, res6 = http_request("PATCH", f"/orders/{order1_id}/status", {"status": "DANG_GIAO"}, token=staff_token)
    d6 = res6.get("data", {})
    p6 = status6 == 200 and d6.get("status") == "DANG_GIAO"
    record("TC-06", "PATCH /orders/<id>/status - Chuyển sang DANG_GIAO", "Lớp 1", "200 OK, status=DANG_GIAO", f"{status6}, status={d6.get('status')}", p6, json.dumps(res6))

    # TC-07: POST /orders/<id>/handover - Bàn giao delivery thành công
    status7, res7 = http_request("POST", f"/orders/{order1_id}/handover", {"order_code_suffix": order1_suffix}, token=staff_token)
    d7 = res7.get("data", {})
    p7 = status7 == 200 and d7.get("status") == "DA_GIAO" and d7.get("payment_status") == "da_thanh_toan" and d7.get("delivered_at") is not None
    record("TC-07", "POST /orders/<id>/handover - Bàn giao giao hàng tận nơi", "Lớp 1", "200 OK, status=DA_GIAO, da_thanh_toan", f"{status7}, status={d7.get('status')}, payment={d7.get('payment_status')}", p7, json.dumps(res7))

    # TC-08: POST /orders/<id>/confirm-receipt - Khách xác nhận đã nhận
    status8, res8 = http_request("POST", f"/orders/{order1_id}/confirm-receipt", token=cust1_token)
    d8 = res8.get("data", {})
    p8 = status8 == 200 and d8.get("status") == "HOAN_THANH" and d8.get("completed_at") is not None
    record("TC-08", "POST /orders/<id>/confirm-receipt - Khách xác nhận hoàn thành", "Lớp 1", "200 OK, status=HOAN_THANH", f"{status8}, status={d8.get('status')}", p8, json.dumps(res8))

    # TC-09: Pickup Order Flow
    cust2_email = f"cust2_{ts}@neu.edu.vn"
    cust2_token = register_user(cust2_email, f"097{((ts+1)%10000000):07d}", "Khách Pickup")
    order2_payload = {
        "order_type": "pickup",
        "recipient_name": "Khách Pickup",
        "recipient_phone": "0971234567",
        "payment_method": "cod_vietqr",
        "items": [{"dish_id": "com-ga-xoi-mo", "quantity": 1}]
    }
    status9, res9 = http_request("POST", "/orders", order2_payload, token=cust2_token)
    d9 = res9.get("data", {})
    order2_id = d9.get("id")
    order2_suffix = d9.get("order_code_suffix")
    p9_create = status9 == 201 and d9.get("ship_fee") == 0.0 and d9.get("campus_location_id") is None and "Quầy trả món Canteen A2" in (d9.get("delivery_address") or "")
    
    # Process -> DANG_CHUAN_BI -> SAN_SANG_LAY -> Handover -> DA_BAN_GIAO -> Confirm Receipt
    http_request("PATCH", f"/orders/{order2_id}/process", {"action": "accept"}, token=staff_token)
    stat_s, stat_r = http_request("PATCH", f"/orders/{order2_id}/status", {"status": "SAN_SANG_LAY"}, token=staff_token)
    d_stat = stat_r.get("data", {})
    p9_deadline = d_stat.get("pickup_deadline") is not None

    hand_s, hand_r = http_request("POST", f"/orders/{order2_id}/handover", {"order_code_suffix": order2_suffix}, token=staff_token)
    d_hand = hand_r.get("data", {})
    p9_hand = hand_s == 200 and d_hand.get("status") == "DA_BAN_GIAO" and d_hand.get("payment_status") == "da_thanh_toan"

    conf_s, conf_r = http_request("POST", f"/orders/{order2_id}/confirm-receipt", token=cust2_token)
    d_conf = conf_r.get("data", {})
    p9_done = conf_s == 200 and d_conf.get("status") == "HOAN_THANH"

    p9_all = p9_create and p9_deadline and p9_hand and p9_done
    record("TC-09", "Toàn bộ luồng đơn Pickup: Tạo -> Sẵn sàng lấy -> Bàn giao tại quầy -> Hoàn thành", "Lớp 1", "201 Created -> SAN_SANG_LAY (có pickup_deadline) -> DA_BAN_GIAO -> HOAN_THANH", f"create={p9_create}, deadline={p9_deadline}, hand={p9_hand}, done={p9_done}", p9_all)

    # TC-10: Khách hủy đơn khi CHO_XAC_NHAN
    cust3_email = f"cust3_{ts}@neu.edu.vn"
    cust3_token = register_user(cust3_email, f"097{((ts+2)%10000000):07d}", "Khách Hủy Đơn")
    _, res_c3 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Hủy", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust3_token)
    order3_id = res_c3["data"]["id"]
    stat_cancel, res_cancel = http_request("POST", f"/orders/{order3_id}/cancel", token=cust3_token)
    d_cancel = res_cancel.get("data", {})
    p10 = stat_cancel == 200 and d_cancel.get("status") == "DA_HUY_KHACH"
    record("TC-10", "POST /orders/<id>/cancel - Khách hủy đơn khi CHO_XAC_NHAN", "Lớp 1", "200 OK, status=DA_HUY_KHACH", f"{stat_cancel}, status={d_cancel.get('status')}", p10, json.dumps(res_cancel))

    # TC-11: Staff Từ chối đơn (reject)
    _, res_c3_new = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Hủy", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust3_token)
    order3_new_id = res_c3_new["data"]["id"]
    stat_rej, res_rej = http_request("PATCH", f"/orders/{order3_new_id}/process", {"action": "reject", "reason": "Cửa hàng hết nguyên liệu"}, token=staff_token)
    d_rej = res_rej.get("data", {})
    p11 = stat_rej == 200 and d_rej.get("status") == "TU_CHOI" and d_rej.get("cancelled_reason") == "Cửa hàng hết nguyên liệu"
    record("TC-11", "PATCH /orders/<id>/process (reject) - Canteen từ chối nhận đơn có lý do", "Lớp 1", "200 OK, status=TU_CHOI", f"{stat_rej}, status={d_rej.get('status')}, reason={d_rej.get('cancelled_reason')}", p11, json.dumps(res_rej))

    # TC-12: Sự cố giao hàng: no_answer
    cust4_email = f"cust4_{ts}@neu.edu.vn"
    cust4_token = register_user(cust4_email, f"097{((ts+3)%10000000):07d}", "Khách Vắng Mặt")
    _, res_c4 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Vắng Mặt", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust4_token)
    order4_id = res_c4["data"]["id"]
    http_request("PATCH", f"/orders/{order4_id}/process", {"action": "accept"}, token=staff_token)
    http_request("PATCH", f"/orders/{order4_id}/status", {"status": "DANG_GIAO"}, token=staff_token)
    stat_issue, res_issue = http_request("POST", f"/orders/{order4_id}/delivery-issue", {"issue_type": "no_answer", "reason": "Gọi 3 cuộc không nghe máy"}, token=staff_token)
    d_issue = res_issue.get("data", {})
    p12 = stat_issue == 200 and d_issue.get("status") == "GIAO_THAT_BAI" and d_issue.get("pickup_deadline") is not None
    record("TC-12", "POST /orders/<id>/delivery-issue (no_answer) - Không liên lạc được", "Lớp 1", "200 OK, status=GIAO_THAT_BAI có pickup_deadline", f"{stat_issue}, status={d_issue.get('status')}", p12, json.dumps(res_issue))

    # TC-13: Sự cố giao hàng: refuse_payment -> BO_DON_BLACKLIST
    cust5_email = f"cust5_{ts}@neu.edu.vn"
    cust5_token = register_user(cust5_email, f"097{((ts+4)%10000000):07d}", "Khách Bùng COD")
    _, res_c5 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Bùng COD", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust5_token)
    order5_id = res_c5["data"]["id"]
    http_request("PATCH", f"/orders/{order5_id}/process", {"action": "accept"}, token=staff_token)
    http_request("PATCH", f"/orders/{order5_id}/status", {"status": "DANG_GIAO"}, token=staff_token)
    stat_boom, res_boom = http_request("POST", f"/orders/{order5_id}/delivery-issue", {"issue_type": "refuse_payment", "reason": "Khách không chịu trả tiền COD"}, token=staff_token)
    d_boom = res_boom.get("data", {})
    p13 = stat_boom == 200 and d_boom.get("status") == "BO_DON_BLACKLIST"
    record("TC-13", "POST /orders/<id>/delivery-issue (refuse_payment) - Khách từ chối trả COD", "Lớp 1", "200 OK, status=BO_DON_BLACKLIST", f"{stat_boom}, status={d_boom.get('status')}", p13, json.dumps(res_boom))

    # =========================================================================
    # LỚP 2: ĐIỀU KIỆN BIÊN & DỮ LIỆU DỊ BIỆT (BOUNDARY & EDGE CASES)
    # =========================================================================
    print("\n--- LỚP 2: ĐIỀU KIỆN BIÊN & DỮ LIỆU DỊ BIỆT (BOUNDARY & EDGE CASES) ---")

    cust_edge_email = f"cust_edge_{ts}@neu.edu.vn"
    cust_edge_token = register_user(cust_edge_email, f"097{((ts+5)%10000000):07d}", "Khách Edge Case")

    # TC-14: Số lượng món = 0
    s14, r14 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 0}]
    }, token=cust_edge_token)
    record("TC-14", "Boundary: Số lượng món = 0", "Lớp 2", "422 Unprocessable Entity", f"{s14}", s14 == 422, json.dumps(r14))

    # TC-15: Số lượng món = -1
    s15, r15 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": -1}]
    }, token=cust_edge_token)
    record("TC-15", "Boundary: Số lượng món = -1", "Lớp 2", "422 Unprocessable Entity", f"{s15}", s15 == 422, json.dumps(r15))

    # TC-16: Số lượng món = 11 (> 10)
    s16, r16 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 11}]
    }, token=cust_edge_token)
    record("TC-16", "Boundary: Số lượng món = 11 (Vượt quá 10 phần)", "Lớp 2", "422 Unprocessable Entity", f"{s16}", s16 == 422, json.dumps(r16))

    # TC-17: Tổng giá trị đơn COD > 500.000 VNĐ (BR-14, EX-11)
    s17, r17 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 10}]
    }, token=cust_edge_token)
    record("TC-17", "Boundary: Đơn COD > 500.000 VNĐ (505.000đ)", "Lớp 2", "400 Bad Request (EX-11)", f"{s17}", s17 == 400, json.dumps(r17))

    # TC-18: Payload rỗng {}
    s18, r18 = http_request("POST", "/orders", {}, token=cust_edge_token)
    record("TC-18", "Edge: Payload rỗng {}", "Lớp 2", "422 Unprocessable Entity", f"{s18}", s18 == 422, json.dumps(r18))

    # TC-19: Thiếu trường bắt buộc (thiếu items)
    s19, r19 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567"
    }, token=cust_edge_token)
    record("TC-19", "Edge: Thiếu trường bắt buộc (items)", "Lớp 2", "422 Unprocessable Entity", f"{s19}", s19 == 422, json.dumps(r19))

    # TC-20: Định dạng SĐT sai (không phải 10 số bắt đầu bằng 0)
    s20, r20 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "12345678",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust_edge_token)
    record("TC-20", "Edge: Sai định dạng SĐT (12345678)", "Lớp 2", "422 Unprocessable Entity", f"{s20}", s20 == 422, json.dumps(r20))

    # TC-21: Non-existent order_id trong GET /orders/<id>
    s21, r21 = http_request("GET", "/orders/NF_NON_EXISTENT_9999", token=cust_edge_token)
    record("TC-21", "Edge: Xem chi tiết đơn không tồn tại", "Lớp 2", "404 Not Found", f"{s21}", s21 == 404, json.dumps(r21))

    # TC-22: Handover sai 4 số cuối (EX-17)
    s22, r22 = http_request("POST", f"/orders/{order4_id}/handover", {"order_code_suffix": "0000"}, token=staff_token)
    p22 = s22 == 400 and ("EX-17" in json.dumps(r22) or "không khớp" in json.dumps(r22))
    record("TC-22", "Edge / EX-17: Bàn giao sai mã 4 số cuối ('0000')", "Lớp 2", "400 Bad Request (EX-17)", f"{s22}", p22, json.dumps(r22))

    # TC-23: Handover mã không hợp lệ (không phải 4 chữ số)
    s23, r23 = http_request("POST", f"/orders/{order4_id}/handover", {"order_code_suffix": "12"}, token=staff_token)
    record("TC-23", "Edge: Handover mã 4 số cuối không đủ 4 chữ số ('12')", "Lớp 2", "422 Unprocessable Entity", f"{s23}", s23 == 422, json.dumps(r23))

    # TC-24: Process reject thiếu lý do
    s24, r24 = http_request("PATCH", f"/orders/{order4_id}/process", {"action": "reject", "reason": "   "}, token=staff_token)
    record("TC-24", "Edge: Từ chối đơn nhưng bỏ trống lý do", "Lớp 2", "422 Unprocessable Entity", f"{s24}", s24 == 422, json.dumps(r24))

    # =========================================================================
    # LỚP 3: BUSINESS EXCEPTIONS (EX), STATE MACHINE & RBAC
    # =========================================================================
    print("\n--- LỚP 3: BUSINESS EXCEPTIONS, STATE MACHINE & RBAC ---")

    # TC-25: Không có JWT Token
    s25, r25 = http_request("POST", "/orders", {"order_type": "delivery"})
    record("TC-25", "RBAC: Gọi POST /orders không kèm Bearer Token", "Lớp 3", "401 Unauthorized", f"{s25}", s25 == 401, json.dumps(r25))

    # TC-26: Customer gọi GET /orders/admin/all
    s26, r26 = http_request("GET", "/orders/admin/all", token=cust1_token)
    record("TC-26", "RBAC: Customer gọi GET /orders/admin/all", "Lớp 3", "403 Forbidden", f"{s26}", s26 == 403, json.dumps(r26))

    # TC-27: Customer gọi PATCH /orders/<id>/process
    s27, r27 = http_request("PATCH", f"/orders/{order1_id}/process", {"action": "accept"}, token=cust1_token)
    record("TC-27", "RBAC: Customer gọi PATCH /orders/<id>/process", "Lớp 3", "403 Forbidden", f"{s27}", s27 == 403, json.dumps(r27))

    # TC-28: Customer gọi POST /orders/<id>/handover
    s28, r28 = http_request("POST", f"/orders/{order1_id}/handover", {"order_code_suffix": "1234"}, token=cust1_token)
    record("TC-28", "RBAC: Customer gọi POST /orders/<id>/handover", "Lớp 3", "403 Forbidden", f"{s28}", s28 == 403, json.dumps(r28))

    # TC-29: EX-12: Khách hủy đơn khi đã ở DANG_CHUAN_BI
    cust6_email = f"cust6_{ts}@neu.edu.vn"
    cust6_token = register_user(cust6_email, f"097{((ts+6)%10000000):07d}", "Khách Cancel Late")
    _, res_c6 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust6_token)
    order6_id = res_c6["data"]["id"]
    http_request("PATCH", f"/orders/{order6_id}/process", {"action": "accept"}, token=staff_token)
    stat_cancel_late, res_cancel_late = http_request("POST", f"/orders/{order6_id}/cancel", token=cust6_token)
    p29 = stat_cancel_late == 400 and ("Bếp đã bắt đầu nấu" in json.dumps(res_cancel_late) or "EX-12" in json.dumps(res_cancel_late))
    record("TC-29", "State Machine / EX-12: Khách hủy đơn khi bếp đang nấu (DANG_CHUAN_BI)", "Lớp 3", "400 Bad Request (EX-12)", f"{stat_cancel_late}", p29, json.dumps(res_cancel_late))

    # TC-30: State Machine: Chuyển trạng thái bất hợp pháp (CHO_XAC_NHAN -> DA_GIAO)
    cust7_email = f"cust7_{ts}@neu.edu.vn"
    cust7_token = register_user(cust7_email, f"097{((ts+7)%10000000):07d}", "Khách Invalid Step")
    _, res_c7 = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust7_token)
    order7_id = res_c7["data"]["id"]
    stat_jump, res_jump = http_request("PATCH", f"/orders/{order7_id}/status", {"status": "DA_GIAO"}, token=staff_token)
    record("TC-30", "State Machine: Nhảy cóc trạng thái từ CHO_XAC_NHAN sang DA_GIAO", "Lớp 3", "400 Bad Request (INVALID_TRANSITION)", f"{stat_jump}", stat_jump == 400, json.dumps(res_jump))

    # TC-31: EX-09: Khách đang có đơn dở dang đặt thêm đơn mới
    stat_double, res_double = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust7_token)
    p31 = stat_double == 400 and "EX-09" in json.dumps(res_double)
    record("TC-31", "BR-08 / EX-09: Chặn tạo đơn mới khi đang có đơn dở dang", "Lớp 3", "400 Bad Request (EX-09)", f"{stat_double}", p31, json.dumps(res_double))

    # TC-32: EX-10: Blacklisted customer đặt đơn (cust5_token)
    stat_bl, res_bl = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Blacklist", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust5_token)
    p32 = stat_bl == 403 and "EX-10" in json.dumps(res_bl)
    record("TC-32", "BR-22 / EX-10: Tài khoản bị Blacklist COD đặt đơn bị chặn 403", "Lớp 3", "403 Forbidden (EX-10)", f"{stat_bl}", p32, json.dumps(res_bl))

    # TC-33: EX-05: Món ăn đã hết hàng (is_available = False: 'com-suon-nuong')
    cust8_email = f"cust8_{ts}@neu.edu.vn"
    cust8_token = register_user(cust8_email, f"097{((ts+8)%10000000):07d}", "Khách Món Hết")
    stat_unavail, res_unavail = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 1, "items": [{"dish_id": "com-suon-nuong", "quantity": 1}]
    }, token=cust8_token)
    p33 = stat_unavail == 400 and "EX-05" in json.dumps(res_unavail)
    record("TC-33", "BR-06 / EX-05: Đặt món ăn đã hết hàng (com-suon-nuong)", "Lớp 3", "400 Bad Request (EX-05)", f"{stat_unavail}", p33, json.dumps(res_unavail))

    # TC-34: EX-07: Địa điểm giao hàng không hợp lệ (campus_location_id = 99999)
    stat_bad_loc, res_bad_loc = http_request("POST", "/orders", {
        "order_type": "delivery", "recipient_name": "Khách Test", "recipient_phone": "0971234567",
        "campus_location_id": 99999, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
    }, token=cust8_token)
    p34 = stat_bad_loc == 400 and "EX-07" in json.dumps(res_bad_loc)
    record("TC-34", "BR-09 / EX-07: Chọn địa điểm giao hàng không tồn tại", "Lớp 3", "400 Bad Request (EX-07)", f"{stat_bad_loc}", p34, json.dumps(res_bad_loc))

    # =========================================================================
    # LỚP 4: REGRESSION & DATA INTEGRITY (POSTGRESQL PORT 5432)
    # =========================================================================
    print("\n--- LỚP 4: REGRESSION & DATA INTEGRITY (POSTGRESQL PORT 5432) ---")

    with engine.connect() as conn:
        # TC-35: Kiểm tra bản ghi orders trong PostgreSQL
        res_sql1 = conn.execute(
            text("SELECT id, order_type, status, subtotal_amount, ship_fee, total_amount, payment_status, completed_at FROM orders WHERE id = :id"),
            {"id": order1_id}
        ).fetchone()
        p35 = (
            res_sql1 is not None and
            res_sql1[1] == "delivery" and
            res_sql1[2] == "HOAN_THANH" and
            float(res_sql1[3]) == 50000.0 and
            float(res_sql1[4]) == 5000.0 and
            float(res_sql1[5]) == 55000.0 and
            res_sql1[6] == "da_thanh_toan" and
            res_sql1[7] is not None
        )
        record("TC-35", "Data Integrity: Kiểm tra bảng orders trong PostgreSQL thật", "Lớp 4", "Row tồn tại, status=HOAN_THANH, total=55000, completed_at != None", f"row={res_sql1}", p35)

        # TC-36: Kiểm tra bảng order_items snapshot trong PostgreSQL
        items_rows = conn.execute(
            text("SELECT dish_id, dish_name, unit_price, base_price, quantity, subtotal FROM order_items WHERE order_id = :id"),
            {"id": order1_id}
        ).fetchall()
        p36 = (
            len(items_rows) == 1 and
            items_rows[0][0] == "pho-bo-tai-lan" and
            float(items_rows[0][2]) == 50000.0 and
            float(items_rows[0][3]) == 45000.0 and
            items_rows[0][4] == 1 and
            float(items_rows[0][5]) == 50000.0
        )
        record("TC-36", "Data Integrity: Kiểm tra snapshot giá và món trong order_items", "Lớp 4", "unit_price=50k, base_price=45k, subtotal=50k", f"items={items_rows}", p36)

        # TC-37: Kiểm tra khách bị Blacklist trong PostgreSQL
        u_row = conn.execute(
            text("SELECT is_blacklisted, blacklist_reason, blacklisted_at FROM users WHERE email = :email"),
            {"email": cust5_email}
        ).fetchone()
        p37 = u_row is not None and u_row[0] is True and "COD" in (u_row[1] or "") and u_row[2] is not None
        record("TC-37", "Data Integrity: Kiểm tra cờ is_blacklisted trong bảng users", "Lớp 4", "is_blacklisted=True, có blacklist_reason và blacklisted_at", f"user={u_row}", p37)

    # Summary
    passed_cnt = sum(1 for r in results if r["status"] == "PASS")
    failed_cnt = sum(1 for r in results if r["status"] == "FAIL")
    total_cnt = len(results)

    print("\n" + "=" * 70)
    print(f"KẾT QUẢ KIỂM THỬ: {passed_cnt}/{total_cnt} PASSED ({failed_cnt} FAILED)")
    print("=" * 70)

    with open("/app/tests/test_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "total": total_cnt,
            "passed": passed_cnt,
            "failed": failed_cnt,
            "results": results
        }, f, ensure_ascii=False, indent=2)

    return 0 if failed_cnt == 0 else 1

if __name__ == "__main__":
    sys.exit(run_tests())
