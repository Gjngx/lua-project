import { useIsPresentationTool } from '@sanity/visual-editing/react';

export default function DisableDraftMode() {
	const isPresentationTool = useIsPresentationTool();
	if (isPresentationTool !== false) return null;

	return (
		<a
			href="/api/draft-mode/disable"
			style={{
				position: 'fixed',
				right: '1rem',
				bottom: '1rem',
				zIndex: 10000,
				borderRadius: '9999px',
				background: '#101112',
				color: '#fff',
				padding: '0.6rem 1rem',
				fontSize: '0.875rem',
				textDecoration: 'none',
			}}
		>
			Disable draft preview
		</a>
	);
}
