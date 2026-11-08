from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

RecruitmentRole = Literal['shipper', 'packing', 'customer_support', 'communications']
RecruitmentStatus = Literal['pending', 'contacting', 'hired', 'rejected']
SLOTS = tuple(f'{day}-{shift}' for day in ('mon','tue','wed','thu','fri','sat') for shift in ('morning','afternoon'))


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr = Field(max_length=255)
    phone: str = Field(pattern=r'^0[35789][0-9]{8}$')
    student_id: str = Field(min_length=1, max_length=30, pattern=r'^[A-Za-z0-9-]+$')
    position: RecruitmentRole
    availability: list[str] = Field(min_length=4, max_length=12)
    intro: str = Field(default='', max_length=2000)

    @field_validator('student_id')
    @classmethod
    def canonical_student(cls, value):
        return value.upper()

    @field_validator('availability')
    @classmethod
    def unique_working_slots(cls, value):
        if len(set(value)) != len(value) or any(slot not in SLOTS for slot in value):
            raise ValueError('Chọn ít nhất 4 ca riêng biệt từ thứ Hai đến thứ Bảy')
        return [slot for slot in SLOTS if slot in value]


class ApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    status: RecruitmentStatus
    internal_note: str = Field(default='', max_length=2000)
    expected_version: int = Field(strict=True, ge=1)


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    full_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(default='', pattern=r'^(0[35789][0-9]{8})?$')
    email: EmailStr | Literal[''] = Field(default='', max_length=255)
    position: Literal['shipper','packing','customer_support','communications','kitchen_assistant','chef','cashier']
    employment_status: Literal['active','on_leave','resigned'] = 'active'
    student_id: str = Field(default='', max_length=30, pattern=r'^[A-Za-z0-9-]*$')
    start_date: date | None = None
    weekly_schedule: list[str] = Field(default_factory=list, max_length=12)
    notes: str = Field(default='', max_length=2000)

    @model_validator(mode='after')
    def fulltime_kitchen(self):
        if self.position in ('chef', 'kitchen_assistant'):
            self.student_id = ''
            if self.employment_status == 'active':
                self.weekly_schedule = list(SLOTS)
        return self

    @field_validator('weekly_schedule')
    @classmethod
    def assigned_slots(cls, value):
        if len(set(value)) != len(value) or any(slot not in SLOTS for slot in value):
            raise ValueError('Lịch phân công trùng hoặc không hợp lệ')
        return [slot for slot in SLOTS if slot in value]

    @field_validator('student_id')
    @classmethod
    def employee_student(cls, value):
        return value.upper()

    @field_validator('email')
    @classmethod
    def employee_email(cls, value):
        return str(value).lower()


class EmployeeUpdate(EmployeeCreate):
    expected_version: int = Field(strict=True, ge=1)


class EmployeeFromApplication(EmployeeCreate):
    start_date: date
    expected_application_version: int = Field(strict=True, ge=1)
