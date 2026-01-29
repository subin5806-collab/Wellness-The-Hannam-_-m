-- [DATA FIX] Update Admin Phones from Manager List
-- Strategy: Match by Name since Phone is missing in Admins
-- (Assumes Names are unique enough for this small team)

UPDATE hannam_admins a
SET phone = m.phone
FROM hannam_managers m
WHERE a.name = m.name
  AND a.phone = '010-0000-0000'; -- Only update dummy numbers

-- [VERIFY] Check if phones are updated
SELECT name, phone, role, email FROM hannam_admins ORDER BY name;
