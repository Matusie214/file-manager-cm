-- Storage policies for files bucket
CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);