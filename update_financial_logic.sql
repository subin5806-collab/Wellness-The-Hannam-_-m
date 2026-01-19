-- [FINANCIAL LOGIC UNIFICATION]
-- Create a View that serves as the Single Source of Truth for balances.
-- Formula: Membership Total Amount - Sum(Care Records Final Price) = Remaining Balance

CREATE OR REPLACE VIEW hannam_membership_real_balances AS
SELECT 
    m.id AS membership_id,
    m.member_id,
    m.product_name,
    m.total_amount,
    m.default_discount_rate,
    m.status,
    m.expiry_date,
    -- Calculate Used Amount (Sum of Care Records)
    COALESCE(SUM(cr.final_price), 0) AS calculated_used_amount,
    -- Calculate Remaining Amount (Total - Used)
    (m.total_amount - COALESCE(SUM(cr.final_price), 0)) AS calculated_remaining_amount
FROM 
    hannam_memberships m
LEFT JOIN 
    hannam_care_records cr ON m.id = cr.membership_id
GROUP BY 
    m.id, m.member_id, m.product_name, m.total_amount, m.default_discount_rate, m.status, m.expiry_date;

-- Comments for documentation
COMMENT ON VIEW hannam_membership_real_balances IS 'Single Source of Truth for Membership Balances. Calculated dynamically from Total - Usage.';
