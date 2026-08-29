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
    phoneNumber,
    creditGroups[]{
      _key,
      _type,
      label,
      contributors[]{
        _key,
        _type,
        name,
        href
      }
    },
    socialLinks[]{
      _key,
      _type,
      platform,
      href
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
      introduction,
      services[]{
        _key,
        _type,
        title,
        specialties,
        image{
          ...,
          asset->{_id, url, metadata{lqip, dimensions}}
        }
      }
    },
    playground{
      leadIn,
      link,
      gallery[]{
        _key,
        _type,
        alt,
        prominence,
        image{
          ...,
          asset->{_id, url, metadata{lqip, dimensions}}
        }
      }
    }
  }
`);
