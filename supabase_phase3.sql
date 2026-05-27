CREATE TABLE analysis_states (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_code              text NOT NULL,
  market_state            text NOT NULL,
  mode                    text NOT NULL,
  weighted_score          float NOT NULL,
  veto_triggered          boolean DEFAULT false,
  veto_source             text,
  persist_cycle_remaining int DEFAULT 0,
  analyzed_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_analysis_states_lookup
  ON analysis_states (stock_code, analyzed_at DESC);
