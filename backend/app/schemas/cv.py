from pydantic import BaseModel


class CVChunkItem(BaseModel):
    section: str
    content: str


class CVEmbeddedSection(BaseModel):
    section: str
    items: list[CVChunkItem]


class CVEmbeddedDataResponse(BaseModel):
    file_id: str
    chunk_count: int
    collection: str
    sections: list[CVEmbeddedSection]


class CVIngestResponse(BaseModel):
    file_name: str
    chunk_count: int
    collection: str
    ids: list[str]


class CVUploadResponse(BaseModel):
    file_id: str
    file_name: str
