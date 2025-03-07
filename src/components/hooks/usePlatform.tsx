import {useContext, useState} from 'react';
import {useLocation, useNavigate, WindowLocation} from '@reach/router';
import {graphql, useStaticQuery} from 'gatsby';
import {parse} from 'query-string';

import PageContext from 'sentry-docs/components/pageContext';

import useLocalStorage from './useLocalStorage';

const query = graphql`
  query UsePlatformQuery {
    allPlatform {
      nodes {
        key
        name
        title
        url
        sdk
        caseStyle
        supportLevel
        fallbackPlatform
        guides {
          key
          name
          title
          url
          sdk
          caseStyle
          supportLevel
          fallbackPlatform
        }
      }
    }
  }
`;

export const formatCaseStyle = (style: string, value: string): string => {
  switch (style) {
    case 'snake_case':
      return value.replace(/-/g, '_');
    case 'camelCase':
      return value
        .split(/-/g)
        .map((val, idx) =>
          idx === 0 ? val : val.charAt(0).toUpperCase() + val.substring(1)
        )
        .join('');
    case 'PascalCase':
      return value
        .split(/-/g)
        .map(val => val.charAt(0).toUpperCase() + val.substring(1))
        .join('');
    default:
      return value;
  }
};

// export enum CaseStyle {
//   canonical,
//   camelCase,
//   PascalCase,
//   snake_case,
// }

// export enum SupportLevel {
//   production,
//   community,
// }

export type Guide = {
  caseStyle: string;
  fallbackPlatform: string;
  key: string;
  name: string;
  sdk: string;
  supportLevel: string;
  title: string;
  url: string;
};

export type Platform = {
  caseStyle: string;
  key: string;
  name: string;
  sdk: string;
  supportLevel: string;
  title: string;
  url: string;
  fallbackPlatform?: string;
  guides?: Guide[];
};

export const DEFAULT_PLATFORM = 'javascript';

const normalizeSlug = (name: string): string => {
  switch (name) {
    case 'cocoa':
      return 'apple';
    case 'browser':
    case 'browsernpm':
      return 'javascript';
    default:
      return name;
  }
};

type PageContextType = {
  [key: string]: any;
  guide?: {
    name: string;
  };
  platform?: {
    name: string;
  };
};

type GetPlatformFromLocation = [[string, string | null] | null, boolean];

/**
 * Return the platform given the current location, if available.
 *
 * In order:
 * - identify platform from path
 * - identify platform from querystring
 *
 * The resulting tuple is `[platformName, guideName]`.
 *
 * @param location
 */
const getPlatformFromLocation = (
  pageContext: PageContextType,
  location?: WindowLocation
): GetPlatformFromLocation => {
  if (pageContext && pageContext.platform) {
    return [[pageContext.platform.name, pageContext.guide?.name], true];
  }

  if (!location) {
    return [null, false];
  }

  const qsPlatform = parse(location.search, {arrayFormat: 'none'}).platform as
    | string
    | null;
  const qsMatch = normalizeSlug(qsPlatform || '').split('.', 2) as [string, null];

  return [qsMatch ?? null, false];
};

const rebuildPathForPlatform = (key: string, currentPath?: string): string => {
  // TODO(dcramer: we'd like to redirect them to the _same_ page on the new platform
  // if we can, but until this is aware of pages that dont exist we direct them to platform home
  const [platformName, guideName] = key.split('.', 2);
  const newPathPrefix = guideName
    ? `/platforms/${platformName}/guides/${guideName}/`
    : `/platforms/${platformName}/`;
  const pattern = /\/platforms\/([^/]+)\/(?:guides\/([^/]+)\/)?.*$/i;
  return currentPath ? currentPath.replace(pattern, newPathPrefix) : newPathPrefix;
};

export const usePlatformList = (): Platform[] => {
  const {
    allPlatform: {nodes: platformList},
  } = useStaticQuery(query);
  return platformList.sort((a: Platform, b: Platform) => {
    // Exclude leading non-alphanumeric characters to order .NET between Native and NodeJS instead of the beginning.
    const skippedPrefix = /^[^a-zA-Z]+/;
    return a.title
      .replace(skippedPrefix, '')
      .localeCompare(b.title.replace(skippedPrefix, ''));
  });
};

/**
 * Return the active platform or guide.

 * @param value platform key in format of `platformName[.guideName]`
 */
export const getPlatform = (key: string): Platform | Guide | null => {
  // XXX(epurkhiser): This is almost certinally a mistake, we should figure out
  // if `getPlatforms` should actually be something more like `useGetPlatforms`
  // or something
  //
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const platformList = usePlatformList();

  if (!key) {
    return null;
  }

  const [platformName, guideName] = key.split('.', 2);
  const activePlatform = platformList.find((p: Platform) => p.key === platformName);
  const activeGuide =
    activePlatform &&
    (activePlatform as Platform).guides.find((g: Guide) => g.name === guideName);

  return activeGuide ?? activePlatform ?? null;
};

type UsePlatform = [
  Platform | Guide | null,
  (value: string, options?: SetPlatformOptions) => void,
  boolean
];

type SetPlatformOptions = {
  noQueryString?: boolean;
};

export const getPlatformsWithFallback = (platform: Platform | Guide): string[] => {
  const result = [platform.key];
  let curPlatform = platform;
  while (curPlatform.fallbackPlatform) {
    result.push(curPlatform.fallbackPlatform);
    curPlatform = getPlatform(curPlatform.fallbackPlatform);
  }
  return result;
};

/**
 * The usePlatform() hook will allow you to reference the currently active platform.
 *
 * ```
 * const [platform, setPlatform] = usePlatform()
 * ```
 *
 * The function signatures differ, where the returned `platform` value is an object of
 * type `Platform`, and `setPlatform` takes the platform name as a string.
 *
 * The active platform is decided based on a few heuristics:
 * - if you're passing the value (first param), its _always_ this value
 * - otherwise if you're on a platform page, its _always_ pulled from the URL
 * - otherwise its pulled from local storage (last platform selected)
 * - otherwise its pulled from `defaultValue` (or `DEFAULT_PLATFORM` if none)
 *
 * If you're operating in a context that is _only_ for a specific platform, you
 * want to pass `defaultValue` with the effective platform to avoid fallbacks.
 */
export default function usePlatform(
  value: string = null,
  useStoredValue: boolean = true,
  useDefault: boolean = true,
  defaultValue: string = DEFAULT_PLATFORM
): UsePlatform {
  const location = useLocation();
  const navigate = useNavigate();

  const pageContext = useContext(PageContext);

  const [storedValue, setStoredValue] = useLocalStorage<string | null>('platform', null);

  const [valueFromLocation, isFixed] = getPlatformFromLocation(pageContext, location);
  let currentValue: string | null =
    value || (valueFromLocation ? valueFromLocation.join('.') : null);

  if (!currentValue && !isFixed && useStoredValue) {
    currentValue = storedValue;
  }

  const [stateValue, setStateValue] = useState(currentValue);

  const setValue = (newValue: string, options: SetPlatformOptions = {}) => {
    if (newValue === currentValue) {
      return;
    }
    setStoredValue(newValue);
    if (!newValue) {
      newValue = defaultValue;
    }
    let path = rebuildPathForPlatform(newValue, location.pathname);
    if (!isFixed && !options.noQueryString) {
      path += `?platform=${newValue}`;
    }
    if (path !== location.pathname) {
      navigate(path);
    }
    setStateValue(newValue);
  };

  const activeValue: Platform | Guide | null =
    getPlatform(stateValue) ?? (useDefault ? getPlatform(defaultValue) : null);

  return [activeValue, setValue, isFixed];
}
