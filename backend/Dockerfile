FROM python:3.11-slim


WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

CMD ["fastapi", "run", "--workers", "4", "main.py", "--port", "8000"]