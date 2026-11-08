"""Bulk discounts and explicitly simulated deposits; never a bank integration."""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from datetime import timedelta
from app.core.security import create_access_token, decode_token
from app.crud.order_policy import OrderError


def compute_bulk(subtotal, servings, shipping):
    subtotal = Decimal(str(subtotal))
    rate = 12 if servings >= 30 else 8 if servings >= 20 else 6 if servings >= 10 else 0
    discount = (subtotal * rate / 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    ship = Decimal(0) if servings >= 5 else Decimal(str(shipping))
    total = subtotal - discount + ship
    deposit = (total / 2).quantize(Decimal('1'), rounding=ROUND_CEILING) if total >= 500000 else Decimal(0)
    return dict(eligible_servings=servings, discount_rate=rate, discount_amount=str(discount),
                shipping_fee=str(ship), total_amount=str(total), deposit_amount=str(deposit),
                cod_due=str(total-deposit), deposit_status='simulated' if deposit else 'none')


def pricing_snapshot(order):
    data = dict(order.bulk_pricing or {})
    if Decimal(data.get('deposit_amount', '0')) and order.status in ('DA_HUY_KHACH','TU_CHOI','TU_DONG_HUY','BO_DON_BLACKLIST'):
        data['deposit_status'] = 'cancelled'
    return data


def cod_due(order):
    return Decimal((order.bulk_pricing or {}).get('cod_due', str(order.total_amount)))


def quote_digest(content, pricing):
    return hashlib.sha256(json.dumps([content, pricing], sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()


def issue_deposit_quote(user_id, content, pricing):
    return create_access_token({'type':'deposit_quote','sub':str(user_id),'digest':quote_digest(content,pricing)}, expires_delta=timedelta(minutes=15))


def verify_deposit_quote(token, user_id, content, pricing):
    payload = decode_token(token) if token else None
    if not payload or not payload.get('exp') or not isinstance(payload.get('jti'),str) or payload.get('type') != 'deposit_quote' or payload.get('sub') != str(user_id) or payload.get('digest') != quote_digest(content,pricing):
        raise OrderError('Vui lòng mở Đặt cọc và xác nhận lại số tiền cọc mô phỏng cho nội dung đơn hiện tại.', 'DEPOSIT_CONFIRMATION_REQUIRED',409)
    return payload['jti']
