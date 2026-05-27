import os
import shutil
import tempfile

from fastapi import UploadFile


def save_upload_to_temp(upload_file: UploadFile) -> str:
    suffix = os.path.splitext(upload_file.filename or "")[1]
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    with open(path, "wb") as handle:
        shutil.copyfileobj(upload_file.file, handle)

    return path


def save_bytes_to_temp(file_bytes: bytes, filename: str) -> str:
    suffix = os.path.splitext(filename or "")[1]
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)

    with open(path, "wb") as handle:
        handle.write(file_bytes)

    return path
