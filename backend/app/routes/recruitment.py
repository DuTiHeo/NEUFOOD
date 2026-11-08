from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, g
from pydantic import ValidationError
from sqlalchemy import or_, cast, String
from sqlalchemy.exc import IntegrityError
from app.core.security import jwt_required
from app.core.limiter import limiter
from app.db.session import get_db
from app.db.models import User
from app.db.recruitment_models import RecruitmentApplication, EmployeeProfile, PersonnelAudit
from app.schemas.recruitment import ApplicationCreate, ApplicationUpdate, EmployeeCreate, EmployeeUpdate, EmployeeFromApplication
from app.crud.recruitment import create_application, update_application, RecruitmentError
from app.utils.helpers import api_response

recruitment_bp = Blueprint('recruitment', __name__)


def _serialize(application):
    return {key: getattr(application, key) for key in ('id','full_name','email','phone','student_id','position',
        'availability','intro','status','internal_note','version','reviewed_by')} | {
        'created_at': application.created_at.isoformat(), 'updated_at': application.updated_at.isoformat()}


def _invalid(message='Dữ liệu hồ sơ không hợp lệ', status=422, code='INVALID_APPLICATION'):
    return api_response(message=message, success=False, status_code=status, errors=[{'code': code}])


def _validation(error):
    labels = {'full_name': 'Họ tên', 'email': 'Email', 'phone': 'Số điện thoại', 'student_id': 'Mã sinh viên', 'position': 'Vị trí', 'availability': 'Lịch đăng ký (ít nhất 4 ca hợp lệ)', 'weekly_schedule': 'Lịch phân công (không trùng ca)', 'start_date': 'Ngày bắt đầu', 'notes': 'Ghi chú', 'internal_note': 'Ghi chú / lý do từ chối', 'status': 'Trạng thái', 'employment_status': 'Trạng thái làm việc', 'expected_version': 'Phiên bản hồ sơ', 'expected_application_version': 'Phiên bản hồ sơ ứng tuyển', 'intro': 'Giới thiệu (tối đa 2000 ký tự)'}
    fields = list(dict.fromkeys(labels.get(str(item['loc'][0]), 'Trường thông tin không được hỗ trợ') for item in error.errors() if item['loc']))
    return _invalid('Vui lòng kiểm tra: ' + ', '.join(fields))


def _manager(db):
    user = db.query(User).filter_by(id=int(g.current_user['sub'])).with_for_update(read=True).first()
    return user if user and user.is_active and user.role == 'manager' else None


@recruitment_bp.route('/applications', methods=['POST'])
@limiter.limit('5 per hour')
def submit_application():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _invalid('Dữ liệu phải là JSON object', 400)
    try:
        data = ApplicationCreate.model_validate(payload)
    except ValidationError as error:
        return _validation(error)
    try:
        with get_db() as db:
            application = create_application(db, data.model_dump(mode='json'))
            receipt = {'id': application.id, 'created_at': application.created_at.isoformat()}
        return api_response(data=receipt, message='Đã tiếp nhận hồ sơ ứng tuyển', status_code=201)
    except RecruitmentError as error:
        return _invalid(str(error), error.status, error.code)
    except IntegrityError as error:
        if getattr(getattr(error.orig, 'diag', None), 'constraint_name', None) == 'recruitment_one_open_student':
            return _invalid('Mã sinh viên này đã có hồ sơ đang chờ xem xét hoặc đang xem xét. Vui lòng liên hệ căn tin để cập nhật.', 409, 'APPLICATION_ALREADY_OPEN')
        raise


def _employee(application):
    return {key: getattr(application, key) for key in ('id','full_name','phone','email','student_id','position','employment_status','weekly_schedule','source_application_id','notes','version')} | {'start_date': application.start_date.isoformat() if application.start_date else None, 'account_link_status': 'not_linked'}


@recruitment_bp.route('/employees', methods=['GET','POST'])
@jwt_required
@limiter.exempt
def employee_profiles():
    with get_db() as db:
        manager = _manager(db)
        if not manager:
            return _invalid('Chỉ quản lý căn tin được quản lý nhân sự', 403, 'FORBIDDEN')
        if request.method == 'POST':
            payload = request.get_json(silent=True)
            if not isinstance(payload, dict):
                return _invalid('Dữ liệu phải là JSON object', 400)
            try:
                data = EmployeeCreate.model_validate(payload)
            except ValidationError as error:
                return _validation(error)
            employee = EmployeeProfile(**data.model_dump())
            if employee.employment_status != 'active':
                employee.weekly_schedule = []
            db.add(employee); db.flush()
            result = _employee(employee)
            _audit(db, 'employee', employee.id, manager_id=manager.id, action='create', before=None, after=result)
        else:
            status = request.args.get('status', '')
            if status and status not in ('active','on_leave','resigned'):
                return _invalid('Trạng thái nhân viên không hợp lệ', 400)
            query = db.query(EmployeeProfile)
            if status:
                query = query.filter_by(employment_status=status)
            query = _filters(query, EmployeeProfile)
            result = [_employee(employee) for employee in query.order_by(EmployeeProfile.full_name, EmployeeProfile.id).all()]
    return api_response(data=result, status_code=201 if request.method == 'POST' else 200)


@recruitment_bp.route('/employees/<employee_id>', methods=['PATCH'])
@jwt_required
@limiter.exempt
def edit_employee(employee_id):
    with get_db() as db:
        manager = _manager(db)
        if not manager:
            return _invalid('Chỉ quản lý căn tin được quản lý nhân sự', 403, 'FORBIDDEN')
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return _invalid('Dữ liệu phải là JSON object', 400)
        try:
            data = EmployeeUpdate.model_validate(payload)
        except ValidationError as error:
            return _validation(error)
        employee = db.query(EmployeeProfile).filter_by(id=employee_id).with_for_update().populate_existing().first()
        if employee is None:
            return _invalid('Không tìm thấy hồ sơ nhân viên', 404, 'EMPLOYEE_NOT_FOUND')
        if employee.version != data.expected_version:
            return _invalid('Hồ sơ đã thay đổi, vui lòng tải lại trước khi lưu.', 409, 'EMPLOYEE_CHANGED')
        before = _employee(employee)
        for key, value in data.model_dump(exclude={'expected_version'}).items():
            setattr(employee, key, value)
        if employee.employment_status != 'active':
            employee.weekly_schedule = []
        employee.version += 1
        employee.updated_at = datetime.now(timezone.utc)
        db.flush()
        result = _employee(employee)
        _audit(db, 'employee', employee.id, manager.id, 'update', before, result)
    return api_response(data=result)


@recruitment_bp.route('/applications', methods=['GET'])
@jwt_required
@limiter.exempt
def list_applications():
    with get_db() as db:
        if not _manager(db):
            return _invalid('Chỉ quản lý căn tin được xem hồ sơ', 403, 'FORBIDDEN')
        try:
            page, limit = int(request.args.get('page', 1)), int(request.args.get('limit', 20))
            if page < 1 or not 1 <= limit <= 100:
                raise ValueError()
        except ValueError:
            return _invalid('Phân trang không hợp lệ', 400)
        status = request.args.get('status', '')
        if status and status not in ('pending','contacting','hired','rejected'):
            return _invalid('Trạng thái hồ sơ không hợp lệ', 400)
        query = db.query(RecruitmentApplication)
        if status:
            query = query.filter_by(status=status)
        query = _filters(query, RecruitmentApplication)
        try:
            after, before = request.args.get('from', ''), request.args.get('to', '')
            if after:
                query = query.filter(RecruitmentApplication.created_at >= datetime.combine(date.fromisoformat(after), datetime.min.time(), tzinfo=timezone(timedelta(hours=7))))
            if before:
                query = query.filter(RecruitmentApplication.created_at < datetime.combine(date.fromisoformat(before)+timedelta(days=1), datetime.min.time(), tzinfo=timezone(timedelta(hours=7))))
            if after and before and after > before:
                return _invalid('Khoảng ngày không hợp lệ', 400)
        except ValueError:
            return _invalid('Ngày phải có định dạng YYYY-MM-DD', 400)
        total = query.count()
        items = query.order_by(RecruitmentApplication.created_at.desc(), RecruitmentApplication.id).offset((page-1)*limit).limit(limit).all()
        return api_response(data={'items': [_serialize(item) for item in items], 'total': total, 'page': page, 'limit': limit})


@recruitment_bp.route('/applications/<application_id>', methods=['GET','PATCH'])
@jwt_required
@limiter.exempt
def application_detail(application_id):
    try:
        with get_db() as db:
            manager = _manager(db)
            if not manager:
                return _invalid('Chỉ quản lý căn tin được xử lý hồ sơ', 403, 'FORBIDDEN')
            if request.method == 'PATCH':
                payload = request.get_json(silent=True)
                if not isinstance(payload, dict):
                    return _invalid('Dữ liệu phải là JSON object', 400)
                try:
                    data = ApplicationUpdate.model_validate(payload)
                except ValidationError as error:
                    return _validation(error)
                application = update_application(db, application_id, data.model_dump(), manager.id)
            else:
                application = db.get(RecruitmentApplication, application_id)
                if application is None:
                    return _invalid('Không tìm thấy hồ sơ ứng tuyển', 404, 'APPLICATION_NOT_FOUND')
            result = _serialize(application)
            linked = db.query(EmployeeProfile.id).filter_by(source_application_id=application.id).first()
            result['employee_id'] = linked.id if linked else None
        return api_response(data=result)
    except RecruitmentError as error:
        return _invalid(str(error), error.status, error.code)


def _filters(query, model):
    q = request.args.get('q', '').strip()[:150]
    if q:
        query = query.filter(or_(*(getattr(model, key).icontains(q, autoescape=True) for key in ('full_name','email','phone'))))
    position = request.args.get('position', '')
    if position:
        query = query.filter(model.position == position)
    shift = request.args.get('shift', '')
    if shift:
        column = model.availability if model is RecruitmentApplication else model.weekly_schedule
        # Slot IDs are validated on write; this matches morning/afternoon across weekdays.
        query = query.filter(cast(column, String).contains(shift, autoescape=True))
    return query


def _audit(db, record_type, record_id, manager_id, action, before, after):
    db.add(PersonnelAudit(record_type=record_type, record_id=record_id, action=action, actor_id=manager_id, details={'before': before, 'after': after}))
    db.flush()


@recruitment_bp.route('/audit/<record_type>/<record_id>', methods=['GET'])
@jwt_required
@limiter.exempt
def personnel_history(record_type, record_id):
    with get_db() as db:
        if not _manager(db):
            return _invalid('Chỉ quản lý căn tin được xem lịch sử', 403, 'FORBIDDEN')
        entries = db.query(PersonnelAudit).filter_by(record_type=record_type, record_id=record_id).order_by(PersonnelAudit.id.desc()).limit(100).all()
        return api_response(data=[{'id': e.id, 'actor_id': e.actor_id, 'action': e.action, 'details': e.details, 'created_at': e.created_at.isoformat()} for e in entries])


@recruitment_bp.route('/applications/<application_id>/employee', methods=['POST'])
@jwt_required
@limiter.exempt
def employ_applicant(application_id):
    with get_db() as db:
        manager = _manager(db)
        if not manager:
            return _invalid('Chỉ quản lý căn tin được tạo nhân viên', 403, 'FORBIDDEN')
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return _invalid('Dữ liệu phải là JSON object', 400)
        try:
            data = EmployeeFromApplication.model_validate(payload)
        except ValidationError as error:
            return _validation(error)
        application = db.query(RecruitmentApplication).filter_by(id=application_id).with_for_update().populate_existing().first()
        if application is None:
            return _invalid('Không tìm thấy hồ sơ ứng tuyển', 404)
        if application.status != 'hired':
            return _invalid('Chỉ tạo nhân viên từ hồ sơ đã chấp nhận', 409, 'APPLICATION_NOT_ACCEPTED')
        if application.version != data.expected_application_version:
            return _invalid('Hồ sơ ứng tuyển đã thay đổi, vui lòng tải lại', 409, 'APPLICATION_CHANGED')
        if db.query(EmployeeProfile.id).filter_by(source_application_id=application_id).first():
            return _invalid('Hồ sơ này đã được tạo thành nhân viên', 409, 'EMPLOYEE_ALREADY_CREATED')
        if data.position not in ('chef','kitchen_assistant') and data.student_id != application.student_id:
            return _invalid('Mã sinh viên phải khớp hồ sơ đã được chấp nhận')
        employee = EmployeeProfile(**data.model_dump(exclude={'expected_application_version'}), source_application_id=application_id)
        if employee.employment_status != 'active':
            employee.weekly_schedule = []
        db.add(employee); db.flush()
        result = _employee(employee)
        _audit(db, 'employee', employee.id, manager.id, 'create_from_application', None, result)
    return api_response(data=result, status_code=201)


@recruitment_bp.errorhandler(IntegrityError)
def employee_conflict(error):
    constraint = getattr(getattr(error.orig, 'diag', None), 'constraint_name', '') or ''
    if constraint in ('employee_unique_student','employee_unique_email','employee_profiles_source_application_id_key'):
        return _invalid('Nhân viên đã tồn tại theo mã sinh viên, email hoặc hồ sơ ứng tuyển. Vui lòng kiểm tra danh sách nhân sự.', 409, 'EMPLOYEE_ALREADY_EXISTS')
    raise error
