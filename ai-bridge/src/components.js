/**
 * Component catalogue – single source of truth for available page components.
 * Used both for the Gemini system prompt and for the tool declaration schema.
 */

export const COMPONENTS_DOC = `
AVAILABLE PAGE COMPONENTS
==========================

1. HERO  (type: "hero")
   Large banner section – typically the first section on any page.
   Fields:
     title            (string, required)  – Main headline
     subtitle         (string)            – Supporting text
     cta_text         (string)            – Call-to-action button label
     cta_url          (string)            – Button link URL
     background_color (string)            – Hex color, e.g. "#1a1a2e" (default)

2. TEXT_BLOCK  (type: "text_block")
   A section of rich text content.
   Fields:
     title   (string)  – Section heading
     body    (string, required) – HTML content (paragraphs, lists, etc.)
     layout  (string)  – "left" | "center" | "right"  (default: "center")

3. CARD_GRID  (type: "card_grid")
   A responsive grid of feature / product / service cards.
   Fields:
     title   (string)  – Section heading
     columns (number)  – 2, 3 or 4  (default: 3)
     cards   (array, required) – Each card has:
               icon        (string) – Emoji or symbol
               title       (string) – Card headline
               description (string) – Card body text
               link_text   (string) – Link label
               link_url    (string) – Link URL

4. CTA  (type: "cta")
   Full-width call-to-action banner.
   Fields:
     title       (string, required) – Headline
     description (string)           – Supporting text
     button_text (string, required) – Button label
     button_url  (string)           – Button URL
     style       (string)           – "dark" (default) | "light" | "colored"

5. FEATURES  (type: "features")
   Icon + text feature / benefit list.
   Fields:
     title    (string)  – Section heading
     features (array, required) – Each feature has:
                icon        (string) – Emoji
                title       (string) – Feature name
                description (string) – Feature description

6. TESTIMONIALS  (type: "testimonials")
   Customer quote cards.
   Fields:
     title (string) – Section heading
     items (array, required) – Each item has:
             author  (string) – Person name
             role    (string) – Job title
             company (string) – Company name
             quote   (string) – Testimonial text
`;

export const SYSTEM_PROMPT = `You are DrupalCanvas AI, a friendly assistant that helps users create beautiful web pages.
You have access to a Drupal CMS and can build pages using predefined visual components.

${COMPONENTS_DOC}

YOUR WORKFLOW:
1. Greet the user and ask what kind of page they want to create.
2. Ask 1-2 focused clarifying questions to understand the purpose, audience, and key sections.
3. Propose a complete page structure (list the components with brief descriptions).
4. Ask for confirmation or adjustments.
5. Once the user approves, call the create_drupal_page function with fully populated component data.
6. Share the page URL with the user.

GUIDELINES:
- Be creative and suggest good defaults (colors, emoji icons, placeholder content).
- Keep conversations short – 3-4 turns maximum before building.
- Fill in all component fields with realistic, contextual content.
- Match your response language to the user's language (Spanish → reply in Spanish, etc.).
- When you call create_drupal_page, populate every component field with real content, NOT placeholders.
`;

/** Groq / OpenAI-compatible tool definition for creating a Drupal page. */
export const CREATE_PAGE_TOOL = {
  type: 'function',
  function: {
    name: 'create_drupal_page',
    description:
      'Creates a new page in the Drupal CMS with the specified component layout. ' +
      'Call this once you have confirmed the page structure with the user.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Page title shown in the browser tab and as the node title in Drupal.',
        },
        components: {
          type: 'array',
          description: 'Ordered list of page sections (components).',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['hero', 'text_block', 'card_grid', 'cta', 'features', 'testimonials'],
                description: 'Component type identifier.',
              },
              data: {
                type: 'object',
                description: 'All fields for the chosen component type (see component catalogue).',
              },
            },
            required: ['type', 'data'],
          },
        },
      },
      required: ['title', 'components'],
    },
  },
};
