FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.txt

COPY app/ ./app/
COPY wsgi.py .

RUN groupadd -r -g 1000 flaskuser && useradd -r -u 1000 -g flaskuser flaskuser \
    && chown -R flaskuser:flaskuser /app

USER 1000

EXPOSE 5000

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
