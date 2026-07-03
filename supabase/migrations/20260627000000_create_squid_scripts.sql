-- SquidScripts: Native CI/CD Pipeline Engine
-- Core tables for pipeline definitions, execution, and secrets

-- Pipeline scripts (user's .squid.yml represented as a record)
CREATE TABLE IF NOT EXISTS public.squid_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    yaml_content TEXT NOT NULL,
    parsed_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    source_path TEXT,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_squid_scripts_user_id ON public.squid_scripts(user_id);

-- Pipeline triggers (normalized from YAML for efficient querying)
CREATE TABLE IF NOT EXISTS public.squid_script_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES public.squid_scripts(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'file_change', 'webhook', 'pipeline_complete')),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_squid_script_triggers_script ON public.squid_script_triggers(script_id);
CREATE INDEX idx_squid_script_triggers_type ON public.squid_script_triggers(trigger_type);

-- Pipeline run history
CREATE TABLE IF NOT EXISTS public.squid_script_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES public.squid_scripts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    execution_plan JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_squid_script_runs_script ON public.squid_script_runs(script_id);
CREATE INDEX idx_squid_script_runs_status ON public.squid_script_runs(status);

-- Individual job executions within a run
CREATE TABLE IF NOT EXISTS public.squid_run_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.squid_script_runs(id) ON DELETE CASCADE,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    step_index INTEGER DEFAULT 0
);

CREATE INDEX idx_squid_run_jobs_run ON public.squid_run_jobs(run_id);

-- Individual step executions within a job
CREATE TABLE IF NOT EXISTS public.squid_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.squid_run_jobs(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    action_use TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    exit_code INTEGER,
    output TEXT DEFAULT '',
    error_message TEXT
);

CREATE INDEX idx_squid_run_steps_job ON public.squid_run_steps(job_id);

-- SquidVault: encrypted secrets for pipelines
CREATE TABLE IF NOT EXISTS public.squid_vault_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    scope JSONB DEFAULT '{"scripts": []}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_squid_vault_secrets_user ON public.squid_vault_secrets(user_id);

-- Enable RLS on all tables
ALTER TABLE public.squid_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squid_script_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squid_script_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squid_run_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squid_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squid_vault_secrets ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users can manage own scripts"
    ON public.squid_scripts FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own triggers"
    ON public.squid_script_triggers FOR ALL
    TO authenticated
    USING (script_id IN (SELECT id FROM public.squid_scripts WHERE user_id = auth.uid()))
    WITH CHECK (script_id IN (SELECT id FROM public.squid_scripts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own runs"
    ON public.squid_script_runs FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage own run jobs"
    ON public.squid_run_jobs FOR ALL
    TO authenticated
    USING (run_id IN (SELECT id FROM public.squid_script_runs WHERE user_id = auth.uid()))
    WITH CHECK (run_id IN (SELECT id FROM public.squid_script_runs WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own run steps"
    ON public.squid_run_steps FOR ALL
    TO authenticated
    USING (job_id IN (SELECT id FROM public.squid_run_jobs WHERE run_id IN (SELECT id FROM public.squid_script_runs WHERE user_id = auth.uid())))
    WITH CHECK (job_id IN (SELECT id FROM public.squid_run_jobs WHERE run_id IN (SELECT id FROM public.squid_script_runs WHERE user_id = auth.uid())));

CREATE POLICY "Users can manage own vault secrets"
    ON public.squid_vault_secrets FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
