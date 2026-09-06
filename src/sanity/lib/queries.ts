import { defineQuery } from 'groq';

export const SITE_CONFIG_QUERY = defineQuery(`
  {
    "favicon": *[_id == "siteSettings"][0].favicon{
      asset->{_id, url, mimeType}
    },
    "audioPlaylist": select(
      count(*[_id == "siteSettings"][0].audioPlaylist[defined(audio.asset)]) > 0 =>
        *[_id == "siteSettings"][0].audioPlaylist[defined(audio.asset)]{
          _key,
          title,
          "src": audio.asset->url,
          "mimeType": audio.asset->mimeType
        },
      *[_id == "homePage"][0].audioPlaylist[defined(audio.asset)]{
        _key,
        title,
        "src": audio.asset->url,
        "mimeType": audio.asset->mimeType
      }
    ),
    "hoverSound": *[_id == "siteSettings"][0].hoverSound{
      "src": asset->url,
      "mimeType": asset->mimeType
    },
    "closeSound": *[_id == "siteSettings"][0].closeSound{
      "src": asset->url,
      "mimeType": asset->mimeType
    }
  }
`);

export const FOOTER_QUERY = defineQuery(`
  *[_id == "footer"][0]{
    _id,
    _type,
    headline,
    primaryActionLabel,
    conversationLabel,
    email,
    phoneLabel,
    phoneNumber
  }
`);

export const LET_TALK_PAGE_QUERY = defineQuery(`
  *[_id == "letTalkPage"][0]{
    _id,
    _type,
    heroImages[]{
      _key,
      _type,
      alt,
      crop,
      hotspot,
      asset->{
        _id,
        url,
        metadata{lqip, dimensions}
      }
    },
    services[]{
      _key,
      _type,
      label
    }
  }
`);

export const HOME_PAGE_QUERY = defineQuery(`
  *[_id == "homePage"][0]{
    _id,
    _type,
    seo{
      title,
      description,
      shareImage{
        ...,
        asset->{_id, url, metadata{lqip, dimensions}}
      }
    },
    hero{
      availabilityMessage,
      headline,
      role,
      location,
      introduction,
      aboutLink,
      cursorVideo{
        asset->{_id, url, mimeType}
      }
    },
    featuredWork{
      heading,
      description,
      closingStatement,
      "projects": selectedProjects[]{
        _key,
        ...@->{
          _id,
          _type,
          title,
          "slug": slug.current,
          summary,
          url,
          coverImage{
            ...,
            asset->{_id, url, metadata{lqip, dimensions}}
          },
          "categories": categories[]->title
        }
      }
    },
    capabilities{
      introduction
    },
    playground{
      leadIn,
      gallery[]{
        _key,
        _type,
        alt,
        image{
          ...,
          asset->{_id, url, metadata{lqip, dimensions}}
        }
      }
    }
  }
`);

// Fixed fields take priority; preserve previously published links during migration.
export const SITE_SOCIAL_LINKS_QUERY = defineQuery(`
  {
    "linkedin": coalesce(
      *[_id == "siteSettings"][0].socialProfiles.linkedin,
      *[_id == "siteSettings"][0].socialLinks[platform == "linkedin"][0].href,
      *[_id == "footer"][0].socialLinks[platform == "linkedin"][0].href
    ),
    "instagram": coalesce(
      *[_id == "siteSettings"][0].socialProfiles.instagram,
      *[_id == "siteSettings"][0].socialLinks[platform == "instagram"][0].href,
      *[_id == "footer"][0].socialLinks[platform == "instagram"][0].href
    ),
    "facebook": coalesce(
      *[_id == "siteSettings"][0].socialProfiles.facebook,
      *[_id == "siteSettings"][0].socialLinks[platform == "facebook"][0].href,
      *[_id == "footer"][0].socialLinks[platform == "facebook"][0].href
    ),
    "dribbble": coalesce(
      *[_id == "siteSettings"][0].socialProfiles.dribbble,
      *[_id == "siteSettings"][0].socialLinks[platform == "dribbble"][0].href,
      *[_id == "footer"][0].socialLinks[platform == "dribbble"][0].href
    )
  }
`);
