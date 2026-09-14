
from pydantic import ConfigDict, BaseModel


class PushSubscriptionBase(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionResponse(PushSubscriptionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PushSubscriptionList(BaseModel):
    subscriptions: list[PushSubscriptionResponse]


class PushSubscriptionFilter(BaseModel):
    endpoint: str | None = None
    offset: int | None = 0
    limit: int | None = 500


class VapidKeyResponse(BaseModel):
    public_key: str | None = None
