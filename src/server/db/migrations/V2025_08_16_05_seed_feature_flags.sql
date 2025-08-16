-- Initial feature flag values

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('public_submission', TRUE, 'Allow public event submissions'),
  ('admin_moderation', TRUE, 'Enable admin moderation interface');
