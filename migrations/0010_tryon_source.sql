-- Keep each smile preview tied to the exact product render selected by the customer.
ALTER TABLE renders ADD COLUMN base_render_id TEXT REFERENCES renders(id);
