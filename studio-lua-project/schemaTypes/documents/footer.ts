import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineArrayMember, defineField, defineType} from 'sanity'

const linkValidation = (value: string | undefined) => {
  if (!value || value === '#' || value.startsWith('/') || /^https?:\/\//.test(value)) {
    return true
  }

  return 'Use #, an internal path starting with /, or a full http(s) URL.'
}

export default defineType({
  name: 'footer',
  title: 'Footer',
  type: 'document',
  icon: EarthGlobeIcon,
  groups: [
    {name: 'contact', title: 'Contact', default: true},
    {name: 'credits', title: 'Credits'},
    {name: 'social', title: 'Social links'},
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
    defineField({
      name: 'creditGroups',
      title: 'Credits',
      type: 'array',
      group: 'credits',
      of: [
        defineArrayMember({
          name: 'creditGroup',
          title: 'Credit group',
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'contributors',
              title: 'Contributors',
              type: 'array',
              of: [
                defineArrayMember({
                  name: 'contributor',
                  title: 'Contributor',
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'name',
                      title: 'Name',
                      type: 'string',
                      validation: (rule) => rule.required(),
                    }),
                    defineField({
                      name: 'href',
                      title: 'Profile link',
                      type: 'string',
                      description: 'Optional. Use # while the profile is unavailable.',
                      validation: (rule) => rule.custom(linkValidation),
                    }),
                  ],
                  preview: {
                    select: {title: 'name', subtitle: 'href'},
                  },
                }),
              ],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: {title: 'label', contributors: 'contributors'},
            prepare({title, contributors}) {
              const count = Array.isArray(contributors) ? contributors.length : 0
              return {title, subtitle: `${count} contributor${count === 1 ? '' : 's'}`}
            },
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links',
      type: 'array',
      group: 'social',
      of: [
        defineArrayMember({
          name: 'socialLink',
          title: 'Social link',
          type: 'object',
          fields: [
            defineField({
              name: 'platform',
              title: 'Platform',
              type: 'string',
              options: {
                list: [
                  {title: 'LinkedIn', value: 'linkedin'},
                  {title: 'Dribbble', value: 'dribbble'},
                  {title: 'Instagram', value: 'instagram'},
                  {title: 'Facebook', value: 'facebook'},
                ],
                layout: 'dropdown',
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'href',
              title: 'Profile link',
              type: 'string',
              validation: (rule) => rule.required().custom(linkValidation),
            }),
          ],
          preview: {
            select: {title: 'platform', subtitle: 'href'},
          },
        }),
      ],
      validation: (rule) => rule.unique(),
    }),
  ],
  initialValue: {
    headline: "Let's make\nsomething people\nremember.",
    primaryActionLabel: 'Say Hello',
    conversationLabel: 'Start a conversation',
    email: 'hi@minhhieu.design',
    phoneLabel: 'Call anytime',
    phoneNumber: '(+84) 343 313 383',
    creditGroups: [
      {
        _key: 'design',
        _type: 'creditGroup',
        label: 'Design',
        contributors: [
          {_key: 'minh-hieu', _type: 'contributor', name: 'Minh Hieu', href: '#'},
          {
            _key: 'divo',
            _type: 'contributor',
            name: 'Divo',
            href: 'https://www.linkedin.com/in/befidie/',
          },
        ],
      },
      {
        _key: 'development',
        _type: 'creditGroup',
        label: 'Development',
        contributors: [{_key: 'giang-dang', _type: 'contributor', name: 'Giang Dang', href: '#'}],
      },
    ],
    socialLinks: [
      {_key: 'linkedin', _type: 'socialLink', platform: 'linkedin', href: '#'},
      {_key: 'dribbble', _type: 'socialLink', platform: 'dribbble', href: '#'},
      {_key: 'instagram', _type: 'socialLink', platform: 'instagram', href: '#'},
      {_key: 'facebook', _type: 'socialLink', platform: 'facebook', href: '#'},
    ],
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
