-- Normalize story punctuation without replacing any article content or publishing drafts.
BEGIN;
WITH changed AS (
    UPDATE articles
    SET draft=replace(replace(draft::text, '–', '-'), '—', '-')::jsonb,
        published=replace(replace(published::text, '–', '-'), '—', '-')::jsonb,
        version=version+1,
        updated_at=now()
    WHERE kind='story'
      AND (draft::text ~ '[–—]' OR published::text ~ '[–—]')
    RETURNING id
)
INSERT INTO article_audit(article_id, actor_id, action, details)
SELECT id, NULL, 'normalize_dashes', '{"change":"Replaced en/em dash with ordinary hyphen only"}'::jsonb FROM changed;
COMMIT;
