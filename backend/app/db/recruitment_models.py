from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, String, Integer, Text, Date, DateTime, ForeignKey, Index, CheckConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from .session import Base


class RecruitmentApplication(Base):
    __tablename__ = 'recruitment_applications'
    id = Column(String(32), primary_key=True, default=lambda: uuid4().hex)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    student_id = Column(String(30), nullable=False)
    position = Column(String(30), nullable=False)
    availability = Column(JSONB, nullable=False)
    intro = Column(Text, nullable=False, default='')
    status = Column(String(20), nullable=False, default='pending')
    internal_note = Column(Text, nullable=False, default='')
    version = Column(Integer, nullable=False, default=1)
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        CheckConstraint("status IN ('pending','contacting','hired','rejected')", name='recruitment_status_check'),
        CheckConstraint("position IN ('shipper','packing','customer_support','communications')", name='recruitment_position_check'),
        CheckConstraint("student_id = upper(btrim(student_id)) AND length(student_id) > 0", name='recruitment_student_check'),
        CheckConstraint("jsonb_typeof(availability) = 'array' AND jsonb_array_length(availability) BETWEEN 4 AND 12", name='recruitment_availability_check'),
        CheckConstraint('version >= 1', name='recruitment_version_check'),
        Index('recruitment_one_open_student', 'student_id', unique=True, postgresql_where=text("status IN ('pending','contacting')")),
        Index('recruitment_status_created', 'status', 'created_at'),
    )


class EmployeeProfile(Base):
    __tablename__ = 'employee_profiles'
    id = Column(String(32), primary_key=True, default=lambda: uuid4().hex)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False, default='')
    email = Column(String(255), nullable=False, default='')
    student_id = Column(String(30), nullable=False, default='')
    start_date = Column(Date)
    source_application_id = Column(String(32), ForeignKey('recruitment_applications.id'), unique=True)
    weekly_schedule = Column(JSONB, nullable=False, default=list)
    position = Column(String(30), nullable=False)
    employment_status = Column(String(20), nullable=False, default='active')
    notes = Column(Text, nullable=False, default='')
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        CheckConstraint("employment_status IN ('active','on_leave','resigned')", name='employee_status_check'),
        CheckConstraint("position IN ('shipper','packing','customer_support','communications','kitchen_assistant','chef','cashier')", name='employee_position_check'),
        CheckConstraint('version >= 1', name='employee_version_check'),
        CheckConstraint("jsonb_typeof(weekly_schedule) = 'array' AND jsonb_array_length(weekly_schedule) BETWEEN 0 AND 12", name='employee_schedule_check'),
        Index('employee_unique_student', 'student_id', unique=True, postgresql_where=text("student_id <> ''")),
        Index('employee_unique_email', 'email', unique=True, postgresql_where=text("email <> ''")),
    )


class PersonnelAudit(Base):
    __tablename__ = 'personnel_audit'
    id = Column(Integer, primary_key=True, autoincrement=True)
    record_type = Column(String(20), nullable=False)
    record_id = Column(String(32), nullable=False, index=True)
    action = Column(String(40), nullable=False)
    actor_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    details = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
