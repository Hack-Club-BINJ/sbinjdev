import z from 'zod'

export const CreateShortcutBody = z.object({
  url: z.url().describe('The URL to redirect to'),
  slug: z
    .string()
    .describe('The suggested slug for the shortcut')
    .min(2)
    .regex(/^[a-zA-Z0-9-]+$/, 'Slug must contain only alnum characters and dashes')
    .refine((value) => !['api'].includes(value), 'Slug is reserved')
    .optional(),
})

export type CreateShortcutBody = z.infer<typeof CreateShortcutBody>
