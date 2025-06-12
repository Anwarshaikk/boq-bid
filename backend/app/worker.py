import os
from redis import Redis
from rq import Worker, Queue, Connection

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
conn = Redis.from_url(redis_url)

if __name__ == "__main__":
    with Connection(conn):
        worker = Worker([Queue()])
        worker.work()
