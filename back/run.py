import uvicorn


def dev():
    uvicorn.run('api.app:app')