import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse request body
        const body = await req.json();
        const { first_name, last_name, email, company_name, notes } = body;

        // Validate required fields
        if (!first_name || !last_name || !email || !notes) {
            return Response.json(
                { error: 'Missing required fields: first_name, last_name, email, notes' },
                { status: 400 }
            );
        }

        // Create waitlist signup using service role (no auth required)
        const signup = await base44.asServiceRole.entities.WaitlistSignup.create({
            first_name,
            last_name,
            email,
            company_name: company_name || '',
            notes,
            status: 'pending'
        });

        return Response.json({ 
            success: true, 
            id: signup.id 
        });
    } catch (error) {
        console.error('Waitlist signup error:', error);
        return Response.json(
            { error: 'Failed to submit waitlist signup' },
            { status: 500 }
        );
    }
});