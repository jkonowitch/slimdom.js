import * as slimdom from '../../src/index';

import { appendAttribute } from '../../src/util/attrMutations';

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

describe('XMLSerializer', () => {
	let document: slimdom.Document;
	let serializer: slimdom.XMLSerializer;
	beforeEach(() => {
		document = new slimdom.Document();
		serializer = new slimdom.XMLSerializer();
	});

	it('returns the empty string if given an Attr', () => {
		expect(serializer.serializeToString(document.createAttribute('test'))).toBe('');
		expect(
			serializer.serializeToString(
				document.createAttributeNS('http://www.example.com/ns', 'test')
			)
		).toBe('');
	});

	it('can serialize a CDATASection', () => {
		expect(serializer.serializeToString(document.createCDATASection('test'))).toBe(
			'<![CDATA[test]]>'
		);
		expect(serializer.serializeToString(document.createCDATASection('&notanentity;'))).toBe(
			'<![CDATA[&notanentity;]]>'
		);
		expect(
			serializer.serializeToString(
				document.createCDATASection('<element><!-- not a comment --></element>')
			)
		).toBe('<![CDATA[<element><!-- not a comment --></element>]]>');

		// As only CDataSection's constructor protects against the invalid ]]> character sequence, certain DOM mutations
		// could result in invalid XML being generated by the serializer (same behavior seen in current browsers)
		const invalidCDataSection = document.createCDATASection('');
		invalidCDataSection.data = 'test]]><not-an-element>';
		expect(serializer.serializeToString(invalidCDataSection)).toBe(
			'<![CDATA[test]]><not-an-element>]]>'
		);
	});

	it('can serialize a Comment', () => {
		expect(serializer.serializeToString(document.createComment('test'))).toBe('<!--test-->');
	});

	it('can serialize a Document', () => {
		expect(
			serializer.serializeToString(document.implementation.createHTMLDocument('title'))
		).toBe(
			'<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>title</title></head><body></body></html>'
		);
	});

	it('can serialize a DocumentFragment', () => {
		const df = document.createDocumentFragment();
		df.appendChild(document.createTextNode('test'));
		df.appendChild(document.createElement('test'));
		df.appendChild(document.createComment('test'));
		expect(serializer.serializeToString(df)).toBe('test<test/><!--test-->');
	});

	it('can serialize a DocumentType', () => {
		expect(
			serializer.serializeToString(document.implementation.createDocumentType('html', '', ''))
		).toBe('<!DOCTYPE html>');
		expect(
			serializer.serializeToString(
				document.implementation.createDocumentType('html', 'a', '')
			)
		).toBe('<!DOCTYPE html PUBLIC "a">');
		expect(
			serializer.serializeToString(
				document.implementation.createDocumentType('html', '', 'a')
			)
		).toBe('<!DOCTYPE html SYSTEM "a">');
		expect(
			serializer.serializeToString(
				document.implementation.createDocumentType('html', 'a', 'b')
			)
		).toBe('<!DOCTYPE html PUBLIC "a" "b">');
	});

	it('can serialize an Element', () => {
		expect(serializer.serializeToString(document.createElement('el'))).toBe('<el/>');
	});

	it('can serialize an Element in the xmlns namespace', () => {
		expect(
			serializer.serializeToString(document.createElementNS(XMLNS_NAMESPACE, 'xmlns:test'))
		).toBe('<xmlns:test/>');
	});

	it('ignores useless default namespace definitions', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'http://www.example.com/ns');
		const child = document.createElementNS('http://www.example.com/ns', 'child');
		child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'http://www.example.com/ns');
		el.appendChild(child);
		expect(serializer.serializeToString(el)).toBe(
			'<test xmlns="http://www.example.com/ns"><child/></test>'
		);
	});

	it('retains null default namespace definitions on prefixed elements', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', '');
		const child = document.createElementNS('http://www.example.com/ns', 'prf:child');
		child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', '');
		el.appendChild(child);
		expect(serializer.serializeToString(el)).toBe(
			'<prf:test xmlns:prf="http://www.example.com/ns" xmlns=""><prf:child xmlns=""/></prf:test>'
		);
	});

	it('ignores useless prefix but not default definitions if elements are prefixed', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', 'http://www.example.com/ns');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'http://www.example.com/ns2');
		const child = document.createElementNS('http://www.example.com/ns', 'prf:child');
		child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', 'http://www.example.com/ns');
		child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'http://www.example.com/ns2');
		el.appendChild(child);
		expect(serializer.serializeToString(el)).toBe(
			'<prf:test xmlns:prf="http://www.example.com/ns" xmlns="http://www.example.com/ns2"><prf:child xmlns="http://www.example.com/ns2"/></prf:test>'
		);
	});

	it('correctly handles returning to the null namespace', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'test');
		const child = document.createElementNS('', 'child');
		child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', '');
		el.appendChild(child);
		child.appendChild(document.createElement('grandChild'));
		expect(serializer.serializeToString(el)).toBe(
			'<test xmlns="http://www.example.com/ns"><child xmlns=""><grandChild/></child></test>'
		);
	});

	it('correctly handles changing the default namespace on prefixed elements', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'http://www.example.com/ns2');
		el.appendChild(document.createElementNS('http://www.example.com/ns2', 'grandChild'));
		expect(serializer.serializeToString(el)).toBe(
			'<prf:test xmlns:prf="http://www.example.com/ns" xmlns="http://www.example.com/ns2"><grandChild/></prf:test>'
		);
	});

	it('correctly handles redefining prefixes', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		const child = document.createElementNS('http://www.example.com/ns2', 'prf:child');
		el.appendChild(child);
		expect(serializer.serializeToString(el)).toBe(
			'<prf:test xmlns:prf="http://www.example.com/ns"><prf:child xmlns:prf="http://www.example.com/ns2"/></prf:test>'
		);
	});

	it('correctly handles conflicting prefixes on elements', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', 'http://www.example.com/ns2');
		expect(serializer.serializeToString(el)).toBe(
			'<ns1:test xmlns:ns1="http://www.example.com/ns" xmlns:prf="http://www.example.com/ns2"/>'
		);
	});

	it('correctly handles conflicting prefixes on attributes', () => {
		const el = document.createElement('test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', 'http://www.example.com/ns');
		el.setAttributeNS('http://www.example.com/ns2', 'prf:attr', 'value');

		expect(serializer.serializeToString(el)).toBe(
			'<test xmlns:prf="http://www.example.com/ns" xmlns:ns1="http://www.example.com/ns2" ns1:attr="value"/>'
		);
	});

	it('always uses prefix xml for the xml namespace', () => {
		const el = document.createElementNS(XML_NAMESPACE, 'test');
		expect(serializer.serializeToString(el)).toBe('<xml:test/>');
	});

	it("doesn't generate a new prefix for namespaced attributes", () => {
		// TODO: this depends on a deviation from the spec (see https://github.com/w3c/DOM-Parsing/issues/29)
		const el = document.createElement('test');
		el.setAttributeNS('http://www.example.com/ns', 'prf:test', 'value');
		expect(serializer.serializeToString(el)).toBe(
			'<test xmlns:prf="http://www.example.com/ns" prf:test="value"/>'
		);
	});

	it('always uses prefix xml for the xml namespace, for attributes', () => {
		const el = document.createElementNS(XML_NAMESPACE, 'test');
		el.setAttributeNS(XML_NAMESPACE, 'prf:id', 'value');
		expect(serializer.serializeToString(el)).toBe('<xml:test xml:id="value"/>');
	});

	it('always uses prefix xml for the xml namespace, even if declared as default', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'prf:test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', XML_NAMESPACE);
		el.appendChild(document.createElementNS(XML_NAMESPACE, 'test'));
		expect(serializer.serializeToString(el)).toBe(
			'<prf:test xmlns:prf="http://www.example.com/ns"><xml:test/></prf:test>'
		);
	});

	it('ignores any namespace declarations for the xml namespace', () => {
		const el = document.createElementNS(XML_NAMESPACE, 'test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', XML_NAMESPACE);
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:xml', XML_NAMESPACE);
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', XML_NAMESPACE);
		expect(serializer.serializeToString(el)).toBe('<xml:test/>');
	});

	it('uses a HTML parser compatible serialization for empty HTML elements', () => {
		const el = document.createElementNS(HTML_NAMESPACE, 'body');
		el.appendChild(document.createElementNS(HTML_NAMESPACE, 'br'));
		el.appendChild(document.createElementNS(HTML_NAMESPACE, 'i'));
		el.appendChild(document.createElement('not-html'));
		expect(serializer.serializeToString(el)).toBe(
			'<body xmlns="http://www.w3.org/1999/xhtml"><br /><i></i><not-html xmlns=""/></body>'
		);
	});

	it('can serialize a ProcessingInstruction', () => {
		expect(
			serializer.serializeToString(document.createProcessingInstruction('target', 'data'))
		).toBe('<?target data?>');
	});

	it('can serialize a Text node', () => {
		expect(serializer.serializeToString(document.createTextNode('test'))).toBe('test');
	});

	it('can serialize an XMLDocument', () => {
		expect(
			serializer.serializeToString(
				document.implementation.createDocument('http://www.example.com/ns', 'test')
			)
		).toBe('<test xmlns="http://www.example.com/ns"/>');
	});

	it("throws if given something that isn't a node", () => {
		expect(() => (serializer as any).serializeToString({ nodeType: 1 })).toThrow(TypeError);
	});
});

describe('serializeToWellFormedString', () => {
	let document: slimdom.Document;
	beforeEach(() => {
		document = new slimdom.Document();
	});

	it("throws if given something that isn't a node", () => {
		expect(() => (slimdom as any).serializeToWellFormedString({ nodeType: 1 })).toThrow(
			TypeError
		);
	});

	it('throws if given an element with a prefixed local name', () => {
		expect(() =>
			slimdom.serializeToWellFormedString(document.createElement('notaprefix:test'))
		).toThrow('InvalidStateError');
	});

	it('throws if given an element in the xmlns namespace', () => {
		expect(() =>
			slimdom.serializeToWellFormedString(
				document.createElementNS(XMLNS_NAMESPACE, 'xmlns:test')
			)
		).toThrow('InvalidStateError');
	});

	it('throws if given a namespace declaration for the xmlns namespace', () => {
		const el = document.createElement('test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', XMLNS_NAMESPACE);
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if given a namespace prefix declaration for the null namespace', () => {
		const el = document.createElement('test');
		el.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:prf', '');
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if an attribute has a prefixed local name', () => {
		const el = document.createElement('test');
		el.setAttribute('prf:test', 'value');
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if the xmlns attribute has the null namespace', () => {
		const el = document.createElementNS('http://www.example.com/ns', 'test');
		el.setAttribute('xmlns', 'http://www.example.com/ns');
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if two attributes share the same local name and namespace', () => {
		const el = document.createElement('test');
		// It is not possible to create this situation using the DOM API, as any attempt to set a namespaced attribute
		// will check by localName / namespaceUri only, and any null-namespaced attribute can not have a prefix.
		// Use an internal function to forceably create the invalid state.
		appendAttribute(document.createAttributeNS('http://www.example.com/ns', 'prf1:test'), el);
		appendAttribute(document.createAttributeNS('http://www.example.com/ns', 'prf2:test'), el);
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if an attribute value contains characters that do not match the Char production', () => {
		const el = document.createElement('test');
		el.setAttribute('test', String.fromCodePoint(0x7));
		expect(() => slimdom.serializeToWellFormedString(el)).toThrow('InvalidStateError');
	});

	it('throws if serializing an empty Document', () => {
		expect(() => slimdom.serializeToWellFormedString(document)).toThrow('InvalidStateError');
	});

	it('throws if a comment contains characters that do not match the Char production', () => {
		const comment = document.createComment(String.fromCodePoint(0x7));
		expect(() => slimdom.serializeToWellFormedString(comment)).toThrow('InvalidStateError');
	});

	it('throws if a comment contains the string "--"', () => {
		const comment = document.createComment('test--test');
		expect(() => slimdom.serializeToWellFormedString(comment)).toThrow('InvalidStateError');
	});

	it('throws if a comment ends with the string "-"', () => {
		const comment = document.createComment('-');
		expect(() => slimdom.serializeToWellFormedString(comment)).toThrow('InvalidStateError');
	});

	it('throws if a text node contains characters that do not match the Char production', () => {
		const text = document.createTextNode(String.fromCodePoint(0x7));
		expect(() => slimdom.serializeToWellFormedString(text)).toThrow('InvalidStateError');
	});

	it("throws if a doctype's publidId contains characters that do not match the PubidChar production", () => {
		const doctype = document.implementation.createDocumentType('name', '\\', '');
		expect(() => slimdom.serializeToWellFormedString(doctype)).toThrow('InvalidStateError');
	});

	it("throws if a doctype's systemId contains characters that do not match the Char production", () => {
		const doctype = document.implementation.createDocumentType(
			'name',
			'',
			String.fromCodePoint(0x7)
		);
		expect(() => slimdom.serializeToWellFormedString(doctype)).toThrow('InvalidStateError');
	});

	it("throws if a doctype's systemId contains both single and double quotes", () => {
		const doctype = document.implementation.createDocumentType('name', '', '\'"');
		expect(() => slimdom.serializeToWellFormedString(doctype)).toThrow('InvalidStateError');
	});

	it("throws if a processing instruction's target contains a colon", () => {
		const pi = document.createProcessingInstruction('tar:get', 'data');
		expect(() => slimdom.serializeToWellFormedString(pi)).toThrow('InvalidStateError');
	});

	it('throws if a processing instruction\'s target is "xml" in any case', () => {
		const pi = document.createProcessingInstruction('XmL', 'data');
		expect(() => slimdom.serializeToWellFormedString(pi)).toThrow('InvalidStateError');
	});

	it("throws if a processing instruction's data contains characters that do not match the Char production", () => {
		const pi = document.createProcessingInstruction('target', String.fromCodePoint(0x7));
		expect(() => slimdom.serializeToWellFormedString(pi)).toThrow('InvalidStateError');
	});

	it('throws if a processing instruction\'s data contains the string "?>"', () => {
		const pi = document.createProcessingInstruction('target', 'test');
		pi.appendData('?>test');
		expect(() => slimdom.serializeToWellFormedString(pi)).toThrow('InvalidStateError');
	});

	it('can serialize normally if there are no well-formedness violations', () => {
		expect(slimdom.serializeToWellFormedString(document.createElement('el'))).toBe('<el/>');
	});
});
