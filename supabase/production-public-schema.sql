--
-- PostgreSQL database dump
--

\restrict FIQxt2KVNKVpwV3rSxzJ5MChtC4AUe21Ljhwe3HNB7caNzHavC0C3fIlUMHET6W

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: crear_perfil_docente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_perfil_docente() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.docentes (user_id, nombres, apellidos, ie, celular, nivel, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombres', 'Docente'),
    coalesce(new.raw_user_meta_data ->> 'apellidos', ''),
    coalesce(new.raw_user_meta_data ->> 'ie', 'Sin especificar'),
    new.raw_user_meta_data ->> 'celular',
    coalesce(new.raw_user_meta_data ->> 'nivel', 'primaria'),
    new.email
  )
  on conflict (correo) do update set
    user_id = excluded.user_id,
    nombres = excluded.nombres,
    apellidos = excluded.apellidos,
    ie = excluded.ie,
    celular = excluded.celular,
    nivel = excluded.nivel;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: docentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docentes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    ie text NOT NULL,
    celular text,
    correo text NOT NULL,
    plan text DEFAULT 'gratuito'::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nivel text DEFAULT 'primaria'::text NOT NULL
);


--
-- Name: materiales_docente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materiales_docente (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    nivel text,
    grado text,
    area text,
    tema text,
    contenido jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT materiales_docente_tipo_check CHECK ((tipo = ANY (ARRAY['session'::text, 'project'::text, 'rubric'::text, 'checklist'::text])))
);


--
-- Name: docentes docentes_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_correo_key UNIQUE (correo);


--
-- Name: docentes docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_pkey PRIMARY KEY (id);


--
-- Name: docentes docentes_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_user_id_key UNIQUE (user_id);


--
-- Name: materiales_docente materiales_docente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiales_docente
    ADD CONSTRAINT materiales_docente_pkey PRIMARY KEY (id);


--
-- Name: docentes_correo_exact_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX docentes_correo_exact_key ON public.docentes USING btree (correo);


--
-- Name: materiales_docente_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX materiales_docente_user_created_idx ON public.materiales_docente USING btree (user_id, created_at DESC);


--
-- Name: docentes docentes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docentes
    ADD CONSTRAINT docentes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: materiales_docente materiales_docente_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiales_docente
    ADD CONSTRAINT materiales_docente_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: docentes Docente actualiza su perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente actualiza su perfil" ON public.docentes FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: materiales_docente Docente actualiza sus materiales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente actualiza sus materiales" ON public.materiales_docente FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: materiales_docente Docente crea sus materiales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente crea sus materiales" ON public.materiales_docente FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: materiales_docente Docente elimina sus materiales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente elimina sus materiales" ON public.materiales_docente FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: docentes Docente lee su perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente lee su perfil" ON public.docentes FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: materiales_docente Docente lee sus materiales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docente lee sus materiales" ON public.materiales_docente FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: docentes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docentes ENABLE ROW LEVEL SECURITY;

--
-- Name: materiales_docente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materiales_docente ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict FIQxt2KVNKVpwV3rSxzJ5MChtC4AUe21Ljhwe3HNB7caNzHavC0C3fIlUMHET6W

