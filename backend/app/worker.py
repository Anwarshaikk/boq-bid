import os
from redis import Redis
from rq import Worker, Queue

# Define the queues the worker should listen to
listen = ['default']

# Get the Redis URL from environment variables, with a fallback for local development
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Establish a connection to Redis
conn = Redis.from_url(redis_url)

if __name__ == "__main__":
    # Create a list of Queue objects
    queues = [Queue(name, connection=conn) for name in listen]
    
    # Create a worker that listens to the specified queues
    worker = Worker(queues, connection=conn)
    
    # Start the worker, which will block until it is stopped
    print(f"Worker starting... Listening on queues: {', '.join(listen)}")
    worker.work()
