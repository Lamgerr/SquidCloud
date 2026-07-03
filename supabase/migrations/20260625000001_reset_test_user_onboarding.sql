-- Reset onboarding_complete for test user yilocat248@noproposal.com
-- Allows re-testing the onboarding flow

UPDATE public.profiles
SET onboarding_complete = false
WHERE id = '36248dd9-6263-48ee-b523-ee510a5c9d0e'
  AND onboarding_complete = true;
