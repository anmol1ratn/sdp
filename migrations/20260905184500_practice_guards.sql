-- Parenthesize CASE expressions so the remote D1 parser does not end the trigger early.
-- D1 executes each write/batch atomically. A failed trigger rolls back both budgets.
CREATE TRIGGER ai_reserve BEFORE INSERT ON ai_calls BEGIN
  SELECT (CASE WHEN NEW.reserved < 0 OR NEW.charged != NEW.reserved OR NEW.settled != 0 THEN RAISE(ABORT,'invalid_reservation') END);
  SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM ai_budget WHERE id=NEW.owner||':'||NEW.month AND spent+NEW.reserved<=cap) THEN RAISE(ABORT,'budget_exceeded') END);
  SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM ai_budget WHERE id='global:'||NEW.month AND spent+NEW.reserved<=cap) THEN RAISE(ABORT,'budget_exceeded') END);
  UPDATE ai_budget SET spent=spent+NEW.reserved WHERE id IN (NEW.owner||':'||NEW.month,'global:'||NEW.month);
END;
CREATE TRIGGER ai_settle BEFORE UPDATE OF settled ON ai_calls WHEN OLD.settled=0 AND NEW.settled=1 BEGIN
  SELECT (CASE WHEN NEW.charged<0 THEN RAISE(ABORT,'invalid_charge') END);
  UPDATE ai_budget SET spent=spent+NEW.charged-OLD.reserved WHERE id IN (NEW.owner||':'||NEW.month,'global:'||NEW.month);
END;
CREATE TRIGGER submissions_immutable BEFORE UPDATE ON practice_submissions BEGIN SELECT RAISE(ABORT,'immutable_submission'); END;
CREATE TRIGGER reviews_immutable BEFORE UPDATE ON practice_reviews BEGIN SELECT RAISE(ABORT,'immutable_review'); END;
-- A deliberately impossible insert aborts a stale completion batch before any writes.
CREATE TABLE practice_fence(id TEXT PRIMARY KEY CHECK(id != 'invalid'));
CREATE TRIGGER attachment_quota BEFORE INSERT ON practice_attachments BEGIN
  SELECT (CASE WHEN (SELECT COALESCE(SUM(bytes),0) FROM practice_attachments WHERE owner=NEW.owner)+NEW.bytes>104857600 THEN RAISE(ABORT,'storage_limit') END);
END;
