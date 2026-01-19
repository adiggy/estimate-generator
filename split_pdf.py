#!/usr/bin/env python3
"""Split a PDF into chunks of 30 pages each."""

import os
import glob
from pypdf import PdfReader, PdfWriter

# Directory configuration
INPUT_DIR = "input"
WORKING_DIR = "working"

def split_pdf(input_path, output_dir, pages_per_chunk=30):
    """Split PDF into chunks of specified page count."""
    reader = PdfReader(input_path)
    total_pages = len(reader.pages)

    print(f"Total pages in PDF: {total_pages}")

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    chunk_num = 1
    start_page = 0

    while start_page < total_pages:
        writer = PdfWriter()
        end_page = min(start_page + pages_per_chunk, total_pages)

        for page_num in range(start_page, end_page):
            writer.add_page(reader.pages[page_num])

        output_filename = os.path.join(output_dir, f"chunk_{chunk_num:02d}.pdf")
        with open(output_filename, "wb") as output_file:
            writer.write(output_file)

        print(f"Created {output_filename} (pages {start_page + 1}-{end_page})")

        start_page = end_page
        chunk_num += 1

    print(f"\nDone! Created {chunk_num - 1} chunk files in {output_dir}/")
    return chunk_num - 1

if __name__ == "__main__":
    # Find PDF files in input directory
    pdf_files = glob.glob(os.path.join(INPUT_DIR, "*.pdf"))

    if not pdf_files:
        print(f"Error: No PDF files found in '{INPUT_DIR}/' folder.")
        print(f"Please place the PDF to audit in the '{INPUT_DIR}/' folder.")
    elif len(pdf_files) > 1:
        print(f"Found multiple PDFs in '{INPUT_DIR}/':")
        for pdf in pdf_files:
            print(f"  - {pdf}")
        print("\nPlease keep only one PDF in the input folder.")
    else:
        input_pdf = pdf_files[0]
        print(f"Found: {input_pdf}")
        split_pdf(input_pdf, WORKING_DIR, pages_per_chunk=30)
