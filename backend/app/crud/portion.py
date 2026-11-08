"""Resolve explicit per-serving choices; never infer extras from names/categories."""
from decimal import Decimal


class PortionError(ValueError):
    pass


def resolve_portions(groups, selections):
    if not isinstance(groups, list) or not isinstance(selections, list):
        raise PortionError("Cấu hình phần thêm không hợp lệ")
    requested = {}
    for selection in selections:
        if not isinstance(selection, dict) or set(selection) - {"slot_id", "choice_id", "addon_ids"}:
            raise PortionError("Lựa chọn phần thêm không hợp lệ")
        slot_id = selection.get("slot_id")
        if not isinstance(slot_id, str) or slot_id in requested:
            raise PortionError("Mỗi suất chỉ được cấu hình một lần")
        requested[slot_id] = selection
    snapshot, total, seen = [], Decimal(0), set()
    for group in groups:
        if (not isinstance(group, dict) or not isinstance(group.get("id"), str)
                or group["id"] in seen or not isinstance(group.get("label"), str)
                or not isinstance(group.get("choices"), list) or not group["choices"]):
            raise PortionError("Cấu hình suất ăn không hợp lệ")
        seen.add(group["id"])
        choices = group["choices"]
        if any(not isinstance(c, dict) or not isinstance(c.get("id"), str)
               or not isinstance(c.get("name", c["id"]), str) for c in choices):
            raise PortionError("Cấu hình món chính không hợp lệ")
        if len({c["id"] for c in choices}) != len(choices):
            raise PortionError("Cấu hình món chính bị trùng")
        selection = requested.get(group["id"], {})
        choice_id = selection.get("choice_id", choices[0]["id"])
        choice = next((c for c in choices if c["id"] == choice_id), None)
        if not choice or choice.get("is_available", True) is not True or group.get("is_available", True) is not True:
            raise PortionError("Suất ăn hoặc món chính không còn phục vụ")
        addons = choice.get("addons", [])
        if not isinstance(addons, list) or any(not isinstance(a, dict) or not isinstance(a.get("id"), str) for a in addons):
            raise PortionError("Cấu hình phần thêm không hợp lệ")
        allowed = {a["id"]: a for a in addons}
        if len(allowed) != len(addons):
            raise PortionError("Cấu hình phần thêm bị trùng")
        ids = selection.get("addon_ids", [])
        if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
            raise PortionError("Mỗi loại phần thêm chỉ được chọn một lần trên mỗi suất")
        resolved = []
        for addon_id in sorted(ids):
            addon = allowed.get(addon_id)
            if not addon or addon.get("is_available", True) is not True:
                raise PortionError("Phần thêm không thuộc suất này hoặc đã hết hàng")
            price = addon.get("price")
            if type(price) is not int or price not in (5000, 10000) or not isinstance(addon.get("name"), str):
                raise PortionError("Giá phần thêm chỉ được là 5k hoặc 10k")
            total += Decimal(price)
            resolved.append({"id": addon_id, "name": addon["name"], "price": price})
        snapshot.append({"slot_id": group["id"], "slot_name": group["label"],
                         "choice_id": choice["id"], "choice_name": choice.get("name", choice["id"]),
                         "addons": resolved})
    if set(requested) - seen:
        raise PortionError("Phần thêm không thuộc món ăn này")
    return snapshot, total
