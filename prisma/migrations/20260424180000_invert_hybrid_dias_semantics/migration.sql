-- Inverte o significado de diasTrabalhoHibrido no formato Híbrido:
-- antes: dias presenciais no escritório → depois: dias em que NÃO trabalha presencialmente.
-- Linhas sem array ou vazias não são alteradas.

DO $$
DECLARE
  r RECORD;
  d TEXT;
  new_json JSONB;
BEGIN
  FOR r IN
    SELECT "userId" AS rid, "diasTrabalhoHibrido" AS dj
    FROM "UserProfile"
    WHERE "formatoTrabalho" = 'Híbrido'
      AND "diasTrabalhoHibrido" IS NOT NULL
      AND jsonb_typeof("diasTrabalhoHibrido") = 'array'
      AND jsonb_array_length("diasTrabalhoHibrido") > 0
  LOOP
    new_json := '[]'::JSONB;
    FOREACH d IN ARRAY ARRAY['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']::TEXT[]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(r.dj) AS e(txt) WHERE e.txt = d
      ) THEN
        new_json := new_json || jsonb_build_array(d);
      END IF;
    END LOOP;
    IF new_json = '[]'::JSONB THEN
      UPDATE "UserProfile" SET "diasTrabalhoHibrido" = NULL WHERE "userId" = r.rid;
    ELSE
      UPDATE "UserProfile" SET "diasTrabalhoHibrido" = new_json WHERE "userId" = r.rid;
    END IF;
  END LOOP;

  FOR r IN
    SELECT "id" AS rid, "diasTrabalhoHibrido" AS dj
    FROM "CreatedUser"
    WHERE "formatoTrabalho" = 'Híbrido'
      AND "diasTrabalhoHibrido" IS NOT NULL
      AND jsonb_typeof("diasTrabalhoHibrido") = 'array'
      AND jsonb_array_length("diasTrabalhoHibrido") > 0
  LOOP
    new_json := '[]'::JSONB;
    FOREACH d IN ARRAY ARRAY['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']::TEXT[]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(r.dj) AS e(txt) WHERE e.txt = d
      ) THEN
        new_json := new_json || jsonb_build_array(d);
      END IF;
    END LOOP;
    IF new_json = '[]'::JSONB THEN
      UPDATE "CreatedUser" SET "diasTrabalhoHibrido" = NULL WHERE "id" = r.rid;
    ELSE
      UPDATE "CreatedUser" SET "diasTrabalhoHibrido" = new_json WHERE "id" = r.rid;
    END IF;
  END LOOP;
END $$;
