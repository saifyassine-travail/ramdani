FROM python:3.12-slim

# poppler-utils: pdftotext -layout, used to read the ANAM reimbursement guide.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      requests==2.32.3 \
      beautifulsoup4==4.12.3 \
      lxml==5.3.0 \
      pdfplumber==0.11.4 \
      rapidfuzz==3.10.1

WORKDIR /work
CMD ["bash"]
