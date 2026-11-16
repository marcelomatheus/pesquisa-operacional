FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .
ARG API_PORT=8000
EXPOSE ${API_PORT}
CMD ["uvicorn", "pivonauta.main:app", "--host", "0.0.0.0", "--port", "8000"]
