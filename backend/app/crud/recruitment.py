from datetime import datetime, timezone
from app.db.recruitment_models import RecruitmentApplication, PersonnelAudit

TRANSITIONS = {'pending': ('contacting',), 'contacting': ('hired', 'rejected'), 'hired': (), 'rejected': ()}


class RecruitmentError(Exception):
    def __init__(self, message, code, status=409):
        super().__init__(message)
        self.code, self.status = code, status


def create_application(db, data):
    application = RecruitmentApplication(**data)
    db.add(application)
    db.flush()
    return application


def update_application(db, application_id, data, manager_id):
    application = db.query(RecruitmentApplication).filter_by(id=application_id).with_for_update().populate_existing().first()
    if application is None:
        raise RecruitmentError('Không tìm thấy hồ sơ ứng tuyển', 'APPLICATION_NOT_FOUND', 404)
    if application.version != data['expected_version']:
        raise RecruitmentError('Hồ sơ đã được cập nhật. Vui lòng tải lại trước khi lưu.', 'APPLICATION_CHANGED')
    if data['status'] != application.status and data['status'] not in TRANSITIONS[application.status]:
        raise RecruitmentError('Không thể chuyển hồ sơ sang trạng thái này', 'INVALID_APPLICATION_TRANSITION')
    if data['status'] == 'rejected' and not data['internal_note']:
        raise RecruitmentError('Vui lòng ghi lý do từ chối hồ sơ', 'REJECTION_REASON_REQUIRED', 422)
    previous = {'status': application.status, 'internal_note': application.internal_note}
    application.status = data['status']
    application.internal_note = data['internal_note']
    application.reviewed_by = manager_id
    application.version += 1
    application.updated_at = datetime.now(timezone.utc)
    db.add(PersonnelAudit(record_type='application', record_id=application.id, action='update', actor_id=manager_id, details={'before': previous, 'after': {'status': application.status, 'internal_note': application.internal_note}}))
    db.flush()
    return application
