/**
 * PARAGRAPH COMPONENT TRACKER
 * TipTap extension for visual component labeling
 * Extracted from TipTapEditor.tsx (Step 2.1.5)
 */

import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isComponentParagraph } from '../../../lib/componentExtraction';

/**
 * Extension that tracks paragraphs as components
 * and adds visual indicators without affecting content
 */
export const ParagraphComponentTracker = Extension.create({
  name: 'paragraphComponentTracker',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let componentNumber = 0;

            // Iterate through the document
            state.doc.forEach((node, offset) => {
              // Each paragraph becomes a component (except [[HEADER]] paragraphs)
              if (node.type.name === 'paragraph' && node.content.size > 0 && node.textContent.trim().length > 0) {
                const trimmedText = node.textContent.trim();

                // Skip [[HEADER]] paragraphs - they are NOT components
                if (!isComponentParagraph(trimmedText)) {
                  return; // Don't show Cx label for header paragraphs
                }

                componentNumber++;

                // Add a widget decoration for the component label
                const widget = Decoration.widget(offset, () => {
                  const label = document.createElement('div');
                  label.className = 'component-label';
                  label.setAttribute('data-component', `C${componentNumber}`);
                  label.textContent = `C${componentNumber}`;
                  label.style.cssText = `
                    position: absolute;
                    left: -50px;
                    background: #6B7280;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    user-select: none;
                    pointer-events: none;
                  `;
                  return label;
                }, {
                  side: -1,
                  marks: []
                });

                decorations.push(widget);
              }
            });

            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});
