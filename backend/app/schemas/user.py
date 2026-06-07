from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    firebase_uid: str

class UserSchema(UserBase):
    id: str
    firebase_uid: str

    class Config:
        from_attributes = True
