import {HomeIcon} from '@sanity/icons/Home'
import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  icon: HomeIcon,
  groups: [
    {name: 'seo', title: 'SEO'},
    {name: 'hero', title: 'Hero', default: true},
    {name: 'work', title: 'Featured works'},
    {name: 'services', title: 'Services'},
    {name: 'playground', title: 'Playground'},
  ],
  fields: [
    defineField({
      name: 'seo',
      title: 'Search and sharing',
      type: 'object',
      group: 'seo',
      fields: [
        defineField({
          name: 'title',
          title: 'Page title',
          type: 'string',
          validation: (rule) => rule.required().max(60),
        }),
        defineField({
          name: 'description',
          title: 'Meta description',
          type: 'text',
          rows: 3,
          validation: (rule) => rule.required().max(160),
        }),
        defineField({
          name: 'shareImage',
          title: 'Social sharing image',
          type: 'image',
          options: {hotspot: true},
        }),
      ],
    }),
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'object',
      group: 'hero',
      fields: [
        defineField({
          name: 'availabilityMessage',
          title: 'Availability message',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'headline',
          title: 'Headline',
          type: 'text',
          rows: 2,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'role',
          title: 'Role',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'location',
          title: 'Location',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'introduction',
          title: 'Introduction',
          type: 'text',
          rows: 4,
        }),
        defineField({
          name: 'aboutLink',
          title: 'About link',
          type: 'callToAction',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'cursorVideo',
          title: 'Cursor video',
          type: 'file',
          description:
            'Upload the MP4 video shown inside the custom cursor while hovering the Home hero.',
          options: {accept: 'video/mp4,.mp4'},
        }),
      ],
    }),
    defineField({
      name: 'audioPlaylist',
      title: 'Music playlist (deprecated)',
      type: 'array',
      of: [defineArrayMember({type: 'audioTrack'})],
      deprecated: {
        reason: 'Music is global. Manage it in Site settings instead.',
      },
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'featuredWork',
      title: 'Featured works',
      type: 'object',
      group: 'work',
      fields: [
        defineField({
          name: 'heading',
          title: 'Heading',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'description',
          title: 'Description',
          type: 'text',
          rows: 2,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'closingStatement',
          title: 'Closing statement',
          type: 'text',
          rows: 2,
          description: 'Press Enter where the heading should break onto a new line.',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'selectedProjects',
          title: 'Projects',
          type: 'array',
          description: 'Pick projects and drag them into the order used on the homepage.',
          of: [
            defineArrayMember({
              type: 'reference',
              to: [{type: 'project'}],
            }),
          ],
          validation: (rule) => rule.required().min(1).unique(),
        }),
        defineField({
          name: 'projects',
          title: 'Legacy embedded projects',
          type: 'array',
          of: [defineArrayMember({type: 'featuredProject'})],
          deprecated: {
            reason:
              'Create standalone Project documents and select them in the Projects field above.',
          },
          readOnly: true,
          hidden: ({value}) => value === undefined,
          initialValue: undefined,
        }),
      ],
    }),
    defineField({
      name: 'capabilities',
      title: 'Services and capabilities',
      type: 'object',
      group: 'services',
      fields: [
        defineField({
          name: 'introduction',
          title: 'Introduction',
          type: 'text',
          rows: 4,
          description: 'Press Enter where the paragraph should break onto a new line.',
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: 'playground',
      title: 'Playground',
      type: 'object',
      group: 'playground',
      fields: [
        defineField({
          name: 'leadIn',
          title: 'Lead-in text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'gallery',
          title: 'Gallery',
          type: 'array',
          description: 'Drag images to control their order on the homepage.',
          of: [defineArrayMember({type: 'playgroundItem'})],
          validation: (rule) => rule.required().min(1),
        }),
      ],
    }),
  ],
  initialValue: {
    seo: {
      title: 'Home',
      description: 'Digital designer creating websites and digital products for great experiences.',
    },
    hero: {
      availabilityMessage: 'Open for any collaborations & offers',
      headline: 'Creating websites and digital products for great experiences',
      role: 'Digital designer based in Vietnam',
      location: 'Hanoi, Vietnam',
      introduction:
        'I find inspiration in the simple things: rice fields, the energy of sports, a good cup of coffee, and a deep passion for design.',
      aboutLink: {
        _type: 'callToAction',
        label: 'More about me',
        href: '/about',
      },
    },
    featuredWork: {
      heading: 'Works',
      description: 'Selection of featured work, across industries',
      closingStatement: 'Ready to help\nwith your needs',
    },
    capabilities: {
      introduction:
        "Discover the amazing features of my services that\ncan transform your workflow and boost productivity.\nHere's what I can do for you:",
    },
    playground: {
      leadIn: 'Have fun with',
    },
  },
  preview: {
    prepare() {
      return {
        title: 'Home page',
        subtitle: 'Homepage content',
      }
    },
  },
})
