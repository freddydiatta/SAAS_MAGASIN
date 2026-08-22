import * as z from 'zod';

// Schémas de validation partagés pour les formulaires qui reposaient jusque
// là uniquement sur des attributs HTML natifs (required, min="0") sans
// message d'erreur clair ni règles métier (ex : Reservations.jsx acceptait
// une date de départ antérieure à la date d'arrivée, car le calcul de prix
// utilise une valeur absolue et ne s'en rend pas compte).

// Login.jsx et Register.jsx définissaient chacun leur propre schéma
// email/mot de passe, mot pour mot identique — le genre de duplication que
// ce fichier existe justement pour éviter ailleurs.
const emailSchema = z.string().email('Veuillez entrer une adresse email valide.');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.');

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
});

export const productSchema = z.object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(200, 'Le nom est trop long.'),
    price: z.coerce.number({ invalid_type_error: 'Le prix doit être un nombre.' })
        .nonnegative('Le prix ne peut pas être négatif.'),
    quantity: z.coerce.number({ invalid_type_error: 'La quantité doit être un nombre.' })
        .int('La quantité doit être un nombre entier.')
        .nonnegative('La quantité ne peut pas être négative.'),
});

export const villaSchema = z.object({
    name: z.string().trim().min(1, 'Le nom du bien est requis.').max(200, 'Le nom est trop long.'),
    address: z.string().trim().max(300, "L'adresse est trop longue.").optional().or(z.literal('')),
    price_per_night: z.coerce.number({ invalid_type_error: 'Le prix doit être un nombre.' })
        .positive('Le prix par nuit doit être supérieur à 0.'),
});

export const reservationSchema = z.object({
    villa_id: z.string().min(1, 'Veuillez sélectionner une villa.'),
    customer_name: z.string().trim().min(1, 'Le nom du client est requis.').max(200, 'Le nom est trop long.'),
    start_date: z.string().min(1, "La date d'arrivée est requise."),
    end_date: z.string().min(1, 'La date de départ est requise.'),
    status: z.string().min(1),
}).refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: "La date de départ doit être après la date d'arrivée.",
    path: ['end_date'],
});

export const menuItemSchema = z.object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(200, 'Le nom est trop long.'),
    category: z.string().min(1),
    price: z.coerce.number({ invalid_type_error: 'Le prix doit être un nombre.' })
        .nonnegative('Le prix ne peut pas être négatif.'),
});

export const cashierSchema = z.object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(100, 'Le nom est trop long.'),
    pin: z.string().regex(/^\d{4}$/, 'Le code PIN doit contenir exactement 4 chiffres.'),
});

export const invoiceCustomerSchema = z.object({
    customerName: z.string().trim().max(200, 'Le nom est trop long.').optional().or(z.literal('')),
    customerPhone: z.string().trim()
        .regex(/^[0-9+\s()-]*$/, 'Numéro de téléphone invalide.')
        .max(30, 'Le numéro est trop long.')
        .optional()
        .or(z.literal('')),
});

export const businessSchema = z.object({
    name: z.string().trim().min(1, "Le nom de l'entreprise est requis.").max(200, 'Le nom est trop long.'),
    type: z.string().min(1, "Le type d'activité est requis."),
    phone: z.string().trim()
        .regex(/^[0-9+\s()-]*$/, 'Numéro de téléphone invalide.')
        .max(30, 'Le numéro est trop long.')
        .optional()
        .or(z.literal('')),
    address: z.string().trim().max(300, "L'adresse est trop longue.").optional().or(z.literal('')),
});

export const restaurantOrderSchema = z.object({
    tableNumber: z.string().trim().max(50, 'Le numéro de table est trop long.').optional().or(z.literal('')),
});

// Extrait le premier message d'erreur d'un résultat zod.safeParse échoué,
// pour l'afficher dans la bannière d'erreur déjà présente sur ces formulaires.
export const firstZodError = (result) => result.error.issues[0]?.message || 'Formulaire invalide.';
