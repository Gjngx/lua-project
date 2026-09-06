import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'footer',
  title: 'Footer',
  type: 'document',
  icon: EarthGlobeIcon,
  groups: [
    {name: 'contact', title: 'Contact', default: true},
  ],
  fields: [
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'text',
      rows: 3,
      group: 'contact',
      description: 'Press Enter where the heading should break onto a new line.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'primaryActionLabel',
      title: 'Primary action label',
      type: 'string',
      group: 'contact',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'conversationLabel',
      title: 'Conversation label',
      type: 'string',
      group: 'contact',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email address',
      type: 'string',
      group: 'contact',
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: 'phoneLabel',
      title: 'Phone label',
      type: 'string',
      group: 'contact',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'phoneNumber',
      title: 'Phone number',
      type: 'string',
      group: 'contact',
      description: 'Enter the number exactly as it should appear on the website.',
      validation: (rule) => rule.required(),
    }),

  ],
  initialValue: {
    headline: "Let's make\nsomething people\nremember.",
    primaryActionLabel: 'Say Hello',
    conversationLabel: 'Start a conversation',
    email: 'hi@minhhieu.design',
    phoneLabel: 'Call anytime',
    phoneNumber: '(+84) 343 313 383',
  },
  preview: {
    prepare() {
      return {
        title: 'Footer',
        subtitle: 'Global footer content',
      }
    },
  },
})
