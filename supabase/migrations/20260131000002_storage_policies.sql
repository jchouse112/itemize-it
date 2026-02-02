-- Set allowed mime types for the receipts bucket
UPDATE storage.buckets
SET allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'application/pdf', 'text/html'
]
WHERE id = 'receipts';

-- Upload: authenticated users can upload to their business's folder
CREATE POLICY "II users can upload to business folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

-- Select: authenticated users can view files in their business's folder
CREATE POLICY "II users can view business files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

-- Update: authenticated users can replace files in their business's folder
CREATE POLICY "II users can update business files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

-- Delete: authenticated users can delete files in their business's folder
CREATE POLICY "II users can delete business files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );
