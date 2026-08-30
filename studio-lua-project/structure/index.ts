import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {CogIcon} from '@sanity/icons/Cog'
import {HomeIcon} from '@sanity/icons/Home'
import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {ProjectsIcon} from '@sanity/icons/Projects'
import {TagIcon} from '@sanity/icons/Tag'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website content')
    .items([
      S.listItem()
        .title('Site settings')
        .icon(CogIcon)
        .child(
          S.document().schemaType('siteSettings').documentId('siteSettings').title('Site settings'),
        ),
      S.listItem()
        .title('Home page')
        .icon(HomeIcon)
        .child(S.document().schemaType('homePage').documentId('homePage').title('Home page')),
      S.listItem()
        .title("Let's Talk page")
        .icon(EnvelopeIcon)
        .child(
          S.document()
            .schemaType('letTalkPage')
            .documentId('letTalkPage')
            .title("Let's Talk page"),
        ),
      S.listItem()
        .title('Footer')
        .icon(EarthGlobeIcon)
        .child(S.document().schemaType('footer').documentId('footer').title('Footer')),
      S.divider(),
      S.documentTypeListItem('project').title('Projects').icon(ProjectsIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
      ...S.documentTypeListItems().filter(
        (item) =>
          !['siteSettings', 'homePage', 'letTalkPage', 'footer', 'project', 'category'].includes(
            item.getId() ?? '',
          ),
      ),
    ])
